import { Suspense } from "react";
import Link from "next/link";
import { FileText, Plus, ShieldCheck } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { businessToday, dayFormat } from "@/lib/dates";
import { listCustomers } from "@/lib/data/sales";
import { vesselOptions } from "@/lib/data/vessels";
import { getJobCard, listJobCards, listWarranties, warrantyState } from "@/lib/data/workshop";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { Badge, ButtonLink, EmptyState, PageHeader, SearchBar, StatCard, cardClass, secondaryButtonSm, tdClass, thClass } from "@/components/ui";
import { LinkTabs } from "../finance/finance-ui";
import { ClaimForm, ClaimStatusSelect, NewWarrantyForm, VoidButton, type WarrantyPrefill } from "./warranty-forms";

type Search = { q?: string; new?: string; job?: string; w?: string; saved?: string; show?: string };
const STATE = { ACTIVE: ["green", "Covered"], EXPIRING: ["amber", "Expires within 30 days"], EXPIRED: ["gray", "Expired"], VOID: ["red", "Void"] } as const;

async function WarrantiesContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "workshop");
  const base = `/c/${slug}/warranties`;
  const todayIso = businessToday();
  const all = (await listWarranties(slug)).map((w) => ({ ...w, state: warrantyState(w, todayIso) }));
  const needle = (search.q ?? "").trim().toLowerCase();
  const show = search.show === "expired" ? "expired" : search.show === "all" ? "all" : "active";
  const shown = all
    .filter((w) => (show === "all" ? true : show === "expired" ? w.state === "EXPIRED" || w.state === "VOID" : w.state === "ACTIVE" || w.state === "EXPIRING"))
    .filter((w) => !needle || [w.number, w.item, w.serialNumber ?? "", w.customerName, w.vessel?.name ?? "", w.sourceLabel ?? ""].some((t) => t.toLowerCase().includes(needle)));
  const open = search.w ? all.find((w) => w.id === search.w) : undefined;

  // "Add warranty" from a job card: prefill customer, vessel and its parts.
  let prefill: WarrantyPrefill | undefined;
  if (search.new && search.job) {
    const job = await getJobCard(slug, search.job);
    if (job)
      prefill = {
        customerId: job.customerId,
        customerName: job.customerName,
        vesselId: job.vessel?.id ?? null,
        sourceType: "JOB_CARD",
        sourceId: job.id,
        sourceLabel: job.number,
        items: job.lines.filter((l) => l.kind !== "LABOR").map((l) => ({ title: l.title, productId: l.productId })),
      };
  }
  const [customers, vessels, jobs] = await Promise.all([
    search.new ? listCustomers() : [],
    search.new ? vesselOptions() : [],
    open ? listJobCards(slug) : [],
  ]);

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Warranties"
        description="What is covered, for whom, until when. Search by serial number when a customer calls; record claims and print the certificate."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New warranty</ButtonLink>}
      />
      {search.saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Warranty saved.
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Covered now" value={String(all.filter((w) => w.state === "ACTIVE" || w.state === "EXPIRING").length)} icon={ShieldCheck} />
        <StatCard label="Expiring within 30 days" value={String(all.filter((w) => w.state === "EXPIRING").length)} />
        <StatCard label="Open claims" value={String(all.reduce((n, w) => n + w.claims.filter((c) => c.status === "OPEN").length, 0))} />
      </div>
      <div className="mt-6 space-y-4">
        <LinkTabs
          active={show}
          tabs={[
            { key: "active", label: "Covered", href: base },
            { key: "expired", label: "Expired & void", href: `${base}?show=expired` },
            { key: "all", label: `All (${all.length})`, href: `${base}?show=all` },
          ]}
        />
        <SearchBar action={base} defaultValue={search.q} placeholder="Search by serial number, item, customer, vessel or job card" keep={{ show: search.show }} />
      </div>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {shown.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No warranties here" description="Add one from a job card, or with New warranty." />
        ) : (
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Warranty</th>
                <th className={thClass}>Item · serial</th>
                <th className={thClass}>Customer · vessel</th>
                <th className={thClass}>Until</th>
                <th className={thClass}>Status</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((w) => (
                <tr key={w.id} className="hover:bg-surface-2/60">
                  <td className={tdClass}>
                    <Link href={`${base}?w=${w.id}`} scroll={false} className="font-mono text-xs font-medium text-brand hover:underline">
                      {w.number}
                    </Link>
                    {w.sourceLabel && <span className="block text-xs text-muted">from {w.sourceLabel}</span>}
                  </td>
                  <td className={tdClass}>
                    <span className="font-medium text-navy">{w.item}</span>
                    {w.serialNumber && <span className="block font-mono text-xs text-muted">S/N {w.serialNumber}</span>}
                  </td>
                  <td className={tdClass}>
                    {w.customerName}
                    {w.vessel && <span className="block text-xs text-muted">{w.vessel.name}</span>}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>{dayFormat.format(w.endDate)}</td>
                  <td className={tdClass}>
                    <Badge tone={STATE[w.state][0]}>{STATE[w.state][1]}</Badge>
                    {w.claims.length > 0 && <span className="ml-2 text-xs text-muted">{w.claims.length} claim{w.claims.length === 1 ? "" : "s"}</span>}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <a href={`${base}/${w.id}/pdf`} target="_blank" rel="noopener" title="Warranty certificate" aria-label="Warranty certificate" className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy">
                      <FileText className="size-4" aria-hidden />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {search.new && (
        <Modal title="New warranty" closeHref={base} size="lg">
          <NewWarrantyForm key={crypto.randomUUID()} companySlug={slug} customers={customers.map((c) => ({ id: c.id, name: c.name }))} vessels={vessels} prefill={prefill} />
        </Modal>
      )}
      {open && (
        <Modal title={`${open.number} · ${open.item}`} closeHref={base} size="lg">
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                <Badge tone={STATE[open.state][0]}>{STATE[open.state][1]}</Badge>{" "}
                <span className="text-muted">
                  {dayFormat.format(open.startDate)} → {dayFormat.format(open.endDate)} · {open.customerName}
                  {open.vessel ? ` · ${open.vessel.name}` : ""}
                  {open.serialNumber ? ` · S/N ${open.serialNumber}` : ""}
                </span>
              </p>
              <div className="flex gap-2">
                <a href={`${base}/${open.id}/pdf`} target="_blank" rel="noopener" className={secondaryButtonSm}>
                  <FileText className="size-3.5" aria-hidden /> Certificate
                </a>
                <VoidButton companySlug={slug} warrantyId={open.id} voided={open.status === "VOID"} />
              </div>
            </div>
            {open.claims.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {open.claims.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">
                        {dayFormat.format(c.date)}
                        {c.jobCard && (
                          <>
                            {" · "}
                            <Link href={`/c/${slug}/workshop/${c.jobCard.id}`} className="font-mono text-brand hover:underline">
                              {c.jobCard.number}
                            </Link>
                          </>
                        )}
                      </p>
                      <p className="text-navy">{c.description}</p>
                      {c.resolution && <p className="text-muted">→ {c.resolution}</p>}
                    </div>
                    <ClaimStatusSelect companySlug={slug} claimId={c.id} status={c.status} />
                  </li>
                ))}
              </ul>
            )}
            <ClaimForm key={crypto.randomUUID()} companySlug={slug} warrantyId={open.id} jobCards={jobs.filter((j) => !open.vessel || j.vessel?.id === open.vessel.id).map((j) => ({ id: j.id, number: j.number }))} />
          </div>
        </Modal>
      )}
    </>
  );
}

export default function WarrantiesPage({ params, searchParams }: PageProps<"/c/[company]/warranties">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading warranties…</p>}>
      <WarrantiesContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
