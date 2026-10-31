import { Suspense } from "react";
import { FileText } from "lucide-react";
import { businessToday, dayFormat } from "@/lib/dates";
import { portalCustomer, portalOffers } from "@/lib/data/portal";
import { formatMoney } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Badge, type Tone } from "@/components/ui";
import { Card, Empty, PageHead, RowLink } from "../_parts";

async function Offers({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const offers = await portalOffers(customer.id);
  const today = businessToday();
  const state = (o: (typeof offers)[number]): [Tone, string] =>
    o.status === "ACCEPTED" ? ["green", "Accepted"] : o.status === "REJECTED" ? ["gray", "Declined"] : o.validUntil.toISOString().slice(0, 10) < today ? ["gray", "Expired"] : ["blue", "Waiting for your answer"];

  return (
    <>
      <PageHead title="Offers" sub="Our price proposals. Open one to read it, download it, and accept or decline it online." />
      <Card title="All offers" icon={FileText}>
        {offers.length === 0 ? (
          <Empty>No offers yet. Ask for a quote in Messages.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {offers.map((o) => {
              const [tone, label] = state(o);
              return (
                <li key={o.id}>
                  <RowLink href={`/p/${token}/offers/${o.id}`}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-navy">{o.subject ?? `Offer ${o.number}`}</span>
                      <span className="block text-xs text-muted">
                        {o.number} · {COMPANIES[o.company].name} · {dayFormat.format(o.offerDate)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="tabular font-semibold text-navy">{formatMoney(o.totalTTC)}</span>
                      <Badge tone={tone}>{label}</Badge>
                    </span>
                  </RowLink>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function PortalOffers({ params }: PageProps<"/p/[token]/offers">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Offers params={params} />
    </Suspense>
  );
}
