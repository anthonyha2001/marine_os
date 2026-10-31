import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { businessToday, dayFormat } from "@/lib/dates";
import { portalCustomer, portalWarranties } from "@/lib/data/portal";
import { COMPANIES } from "@/lib/permissions";
import { Badge, cardClass, type Tone } from "@/components/ui";
import { Empty, PageHead } from "../_parts";
import { ClaimForm } from "../portal-forms";

const CLAIM: Record<string, [Tone, string]> = { OPEN: ["amber", "Being reviewed"], ACCEPTED: ["green", "Accepted"], REJECTED: ["red", "Not covered"], RESOLVED: ["gray", "Resolved"] };

async function Warranties({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const warranties = await portalWarranties(customer.id);
  const today = businessToday();
  const soon = new Date(new Date(`${today}T00:00:00Z`).getTime() + 30 * 86400000).toISOString().slice(0, 10);

  return (
    <>
      <PageHead title="Warranties" sub="What is covered and until when. Something wrong with a covered item? Make a claim here." />
      {warranties.length === 0 ? (
        <div className={cardClass}>
          <Empty>No warranty on your account yet.</Empty>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {warranties.map((w) => {
            const end = w.endDate.toISOString().slice(0, 10);
            const [tone, label]: [Tone, string] = w.status === "VOID" ? ["red", "Void"] : end < today ? ["gray", "Ended"] : end <= soon ? ["amber", "Ends soon"] : ["green", "Covered"];
            const active = w.status !== "VOID" && end >= today;
            return (
              <article key={w.id} id={w.id} className={`${cardClass} scroll-mt-20 p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <ShieldCheck className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-semibold text-navy">{w.item}</span>
                      <span className="block text-xs text-muted">
                        {w.number} · {COMPANIES[w.company].name}
                        {w.vessel && ` · ${w.vessel.name}`}
                      </span>
                    </span>
                  </span>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">From</dt>
                    <dd className="font-medium text-navy">{dayFormat.format(w.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Until</dt>
                    <dd className="font-medium text-navy">{dayFormat.format(w.endDate)}</dd>
                  </div>
                  {w.serialNumber && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted">Serial number</dt>
                      <dd className="font-mono text-navy">{w.serialNumber}</dd>
                    </div>
                  )}
                </dl>
                {w.terms && <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-slate-700">{w.terms}</p>}
                {w.claims.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                    {w.claims.map((c) => (
                      <li key={c.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-xs text-muted">Claim of {dayFormat.format(c.date)}</span>
                          <span className="line-clamp-2 block text-navy">{c.description.replace(/^From the customer portal: /, "")}</span>
                          {c.resolution && <span className="block text-xs text-muted">{c.resolution}</span>}
                        </span>
                        <Badge tone={CLAIM[c.status]?.[0] ?? "gray"}>{CLAIM[c.status]?.[1] ?? c.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {active && (
                  <div className="mt-4 border-t border-border pt-4">
                    <ClaimForm token={token} warrantyId={w.id} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function PortalWarranties({ params }: PageProps<"/p/[token]/warranties">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Warranties params={params} />
    </Suspense>
  );
}
