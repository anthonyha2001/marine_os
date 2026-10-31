import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Hammer, Pencil, ShieldCheck } from "lucide-react";
import { NewJobCardDialog } from "@/components/create-dialogs";
import { requireModule } from "@/lib/auth";
import { dayFormat, businessToday } from "@/lib/dates";
import { listCustomers, listInvoices, listOffers } from "@/lib/data/sales";
import { getVessel } from "@/lib/data/vessels";
import { JOB_STATUS, JOB_TONE, listJobCards, listWarranties, warrantyState } from "@/lib/data/workshop";
import { formatMoney } from "@/lib/money";
import { OFFER_STATUSES } from "@/lib/offers";
import { COMPANIES, canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Modal } from "@/components/modal";
import { Badge, EmptyState, PageHeader, cardClass, primaryButton, secondaryButton } from "@/components/ui";
import { VesselForm } from "../vessel-form";

type Event = { date: Date; kind: "job" | "offer" | "invoice" | "warranty"; label: string; detail: string; href: string; badge?: { tone: "blue" | "amber" | "green" | "gray" | "red"; text: string }; amount?: number };

async function VesselDetail({ params, searchParams }: { params: Promise<{ company: string; vesselId: string }>; searchParams: Promise<{ edit?: string; saved?: string; create?: string }> }) {
  const [{ company, vesselId }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "customers");
  const vessel = await getVessel(vesselId);
  if (!vessel) notFound();
  const base = `/c/${slug}/vessels/${vessel.id}`;
  const can = (m: Parameters<typeof canAccessModule>[2]) => canAccessModule(user, slug, m);

  // History in this company: job cards, offers, invoices and warranties for this boat.
  const [jobs, offers, invoices, warranties, linkIds, customers] = await Promise.all([
    can("workshop") ? listJobCards(slug) : [],
    can("offers") ? listOffers(slug) : [],
    can("invoices") ? listInvoices(slug) : [],
    can("workshop") ? listWarranties(slug) : [],
    Promise.all([
      prisma.offer.findMany({ where: { vesselId: vessel.id }, select: { id: true } }),
      prisma.invoice.findMany({ where: { vesselId: vessel.id }, select: { id: true } }),
    ]),
    search.edit ? listCustomers() : [],
  ]);
  const offerIds = new Set(linkIds[0].map((o) => o.id));
  const invoiceIds = new Set(linkIds[1].map((i) => i.id));
  const todayIso = businessToday();
  const events: Event[] = [
    ...jobs
      .filter((j) => j.vessel?.id === vessel.id)
      .map((j) => ({
        date: j.openedAt,
        kind: "job" as const,
        label: j.number,
        detail: `${j.complaint}${j.engineHours !== null ? ` · ${j.engineHours} h` : ""}${j.technician ? ` · ${j.technician}` : ""}`,
        href: `/c/${slug}/workshop/${j.id}`,
        badge: { tone: JOB_TONE[j.status], text: JOB_STATUS[j.status] },
        amount: j.totalHT,
      })),
    ...offers
      .filter((o) => offerIds.has(o.id))
      .map((o) => ({ date: o.offerDate, kind: "offer" as const, label: o.number, detail: o.subject ?? "Offer", href: `/c/${slug}/offers/${o.id}`, badge: { tone: "blue" as const, text: OFFER_STATUSES[o.status] }, amount: o.totalTTC })),
    ...invoices
      .filter((i) => invoiceIds.has(i.id) && i.status !== "CANCELLED")
      .map((i) => ({ date: i.invoiceDate, kind: "invoice" as const, label: i.number, detail: "Invoice", href: `/c/${slug}/invoices/${i.id}`, amount: i.totalTTC })),
    ...warranties
      .filter((w) => w.vessel?.id === vessel.id)
      .map((w) => {
        const st = warrantyState(w, todayIso);
        return {
          date: w.startDate,
          kind: "warranty" as const,
          label: w.number,
          detail: `${w.item}${w.serialNumber ? ` · S/N ${w.serialNumber}` : ""} · until ${dayFormat.format(w.endDate)}`,
          href: `/c/${slug}/warranties?q=${encodeURIComponent(w.number)}`,
          badge: { tone: st === "ACTIVE" ? ("green" as const) : st === "EXPIRING" ? ("amber" as const) : ("gray" as const), text: st === "ACTIVE" ? "Covered" : st === "EXPIRING" ? "Expiring" : st === "VOID" ? "Void" : "Expired" },
        };
      }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const ICON = { job: Hammer, offer: FileText, invoice: FileText, warranty: ShieldCheck };

  const facts: [string, string][] = [
    ["Owner", vessel.customer?.name ?? "—"],
    ["Type", vessel.type ?? "—"],
    ["Make / model", [vessel.make, vessel.model].filter(Boolean).join(" ") || "—"],
    ["Length", vessel.lengthM ? `${vessel.lengthM} m` : "—"],
    ["Year built", vessel.year?.toString() ?? "—"],
    ["Home port", vessel.homePort ?? "—"],
    ["Registration", vessel.registration ?? "—"],
    ["Hull ID", vessel.hullNumber ?? "—"],
  ];

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Vessel`}
        title={vessel.name}
        description={vessel.customer?.name}
        action={
          <>
            {can("workshop") && (
              <Link href={`${base}?create=job`} scroll={false} className={primaryButton}>
                <Hammer className="size-4" aria-hidden /> New job card
              </Link>
            )}
            <Link href={`${base}?edit=1`} scroll={false} className={secondaryButton}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Link>
          </>
        }
      />
      {search.saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Vessel saved.
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_1fr]">
        <aside className="space-y-6">
          <dl className={`${cardClass} grid grid-cols-2 gap-4 p-5`}>
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-navy">{value}</dd>
              </div>
            ))}
          </dl>
          <section className={`${cardClass} overflow-hidden`}>
            <h2 className="border-b border-border px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted">Engines</h2>
            {vessel.engines.length === 0 ? (
              <p className="p-4 text-sm text-muted">No engines recorded.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {vessel.engines.map((e) => (
                  <li key={e.id} className="px-4 py-3">
                    <p className="font-medium text-navy">
                      {e.position} · {[e.make, e.model].filter(Boolean).join(" ") || "—"}
                    </p>
                    <p className="text-xs text-muted">
                      {[e.serialNumber && `S/N ${e.serialNumber}`, e.year && `${e.year}`, e.hours !== null && `${e.hours} h`].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {vessel.notes && <p className={`${cardClass} whitespace-pre-line p-4 text-sm text-muted`}>{vessel.notes}</p>}
        </aside>

        <section className={`${cardClass} overflow-hidden`}>
          <h2 className="border-b border-border px-4 py-3 font-semibold text-navy">History</h2>
          {events.length === 0 ? (
            <EmptyState icon={Hammer} title="No history yet" description="Job cards, offers, invoices and warranties for this boat appear here." />
          ) : (
            <ol className="divide-y divide-border">
              {events.map((e) => {
                const Icon = ICON[e.kind];
                return (
                  <li key={`${e.kind}-${e.label}`} className="flex gap-3 px-4 py-3 hover:bg-surface-2/60">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <Link href={e.href} className="font-mono text-xs font-medium text-brand hover:underline">
                          {e.label}
                        </Link>
                        <span className="text-xs text-muted">{dayFormat.format(e.date)}</span>
                        {e.badge && <Badge tone={e.badge.tone}>{e.badge.text}</Badge>}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-navy">{e.detail}</p>
                    </div>
                    {e.amount !== undefined && <span className="tabular shrink-0 text-sm font-medium text-navy">{formatMoney(e.amount)}</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {search.edit && (
        <Modal title={`Edit ${vessel.name}`} closeHref={base} size="xl">
          <VesselForm key={crypto.randomUUID()} companySlug={slug} vessel={vessel} customers={customers.map((c) => ({ id: c.id, name: c.name }))} />
        </Modal>
      )}
      {search.create === "job" && can("workshop") && <NewJobCardDialog slug={slug} closeHref={base} vesselId={vessel.id} customerId={vessel.customer?.id} />}
    </>
  );
}

export default function VesselPage({ params, searchParams }: PageProps<"/c/[company]/vessels/[vesselId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <VesselDetail params={params} searchParams={searchParams as Promise<{ edit?: string; saved?: string; create?: string }>} />
    </Suspense>
  );
}
