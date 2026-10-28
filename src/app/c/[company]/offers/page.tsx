import { Suspense } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { listOffers } from "@/lib/data/sales";
import { formatMoney } from "@/lib/money";

import { COMPANIES } from "@/lib/permissions";
import { cardClass, PageHeader, ButtonLink, SearchBar } from "@/components/ui";
import { deleteOffer } from "@/lib/actions/offers";
import { DeleteButton } from "@/components/delete-button";
import { StatusSelect } from "./status-select";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

async function OffersContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ company }, { q = "" }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "offers");
  const needle = q.trim().toLowerCase();
  const offers = (await listOffers(slug)).filter(
    (o) =>
      !needle ||
      o.number.toLowerCase().includes(needle) ||
      o.customerName.toLowerCase().includes(needle) ||
      (o.subject ?? "").toLowerCase().includes(needle),
  );
  const base = `/c/${slug}/offers`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Offers"
        description="Quotations sent to customers by this company."
        action={<ButtonLink icon={Plus} href={`${base}/new`}>New offer</ButtonLink>}
      />

      <div className="mt-6">
        <SearchBar action={base} defaultValue={q} placeholder="Search by number, customer or subject" />
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {offers.length === 0 ? (
          <p className="p-10 text-center text-muted">{q ? "No offers match this search." : "No offers yet. Press Shift+F2 to create one."}</p>
        ) : (
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="w-16 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {offers.map((o) => {
                const expired = o.status !== "ACCEPTED" && o.status !== "REJECTED" && o.validUntil.toISOString().slice(0, 10) < today;
                return (
                  <tr key={o.id} className="hover:bg-background/60">
                    <td className="px-4 py-3">
                      <Link href={`${base}/${o.id}`} className="font-mono font-medium text-brand hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{dateFormat.format(o.offerDate)}</td>
                    <td className="px-4 py-3 font-medium text-navy">{o.customerName}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted">{o.subject ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusSelect companySlug={slug} offerId={o.id} status={o.status} />
                      {expired && <span className="ml-2 text-xs text-danger">Expired</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(o.totalTTC)}</td>
                    <td className="px-2 py-3 text-right">
                      {/* Offers with invoices (even cancelled ones) can't be deleted. */}
                      {o.invoiceCount === 0 && (
                        <DeleteButton
                          action={deleteOffer.bind(null, slug, o.id)}
                          confirmText={`Delete offer ${o.number} for ${o.customerName}? This can't be undone.`}
                          title="Delete offer"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function OffersPage({ params, searchParams }: PageProps<"/c/[company]/offers">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading offers…</p>}>
      <OffersContent params={params} searchParams={searchParams as Promise<{ q?: string }>} />
    </Suspense>
  );
}
