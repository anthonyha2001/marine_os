import { Suspense } from "react";
import Link from "next/link";
import { Gauge, Sailboat } from "lucide-react";
import { dayFormat } from "@/lib/dates";
import { portalBoats, portalCustomer } from "@/lib/data/portal";
import { cardClass } from "@/components/ui";
import { Empty, PageHead } from "../_parts";

async function Boats({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const boats = await portalBoats(customer.id);
  return (
    <>
      <PageHead title="My boats" sub="Engines and hours, everything done on each boat, and its warranties." />
      {boats.length === 0 ? (
        <div className={cardClass}>
          <Empty>No boat on your account yet. Tell us about your boat in Messages and we&apos;ll add it.</Empty>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {boats.map((b) => (
            <Link key={b.id} href={`/p/${token}/boats/${b.id}`} className={`${cardClass} block p-5 transition hover:border-brand/40 hover:shadow-md`}>
              <span className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Sailboat className="size-6" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold text-navy">{b.name}</span>
                  <span className="block text-sm text-muted">{[b.type, b.make, b.model, b.year].filter(Boolean).join(" · ") || "—"}</span>
                </span>
              </span>
              {b.engines.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
                  {b.engines.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted">{[e.position, e.make, e.model].filter(Boolean).join(" ")}</span>
                      <span className="flex items-center gap-1 font-medium text-navy">
                        <Gauge className="size-3.5 text-brand" aria-hidden /> {e.hours ?? "—"} h
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <span className="mt-3 block text-xs text-muted">{b.lastJob ? `Last work: ${dayFormat.format(b.lastJob.completedAt ?? b.lastJob.openedAt)}` : "No work recorded yet"}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function PortalBoats({ params }: PageProps<"/p/[token]/boats">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Boats params={params} />
    </Suspense>
  );
}
