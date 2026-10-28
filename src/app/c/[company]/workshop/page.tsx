import { Suspense } from "react";
import Link from "next/link";
import { Hammer, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { JOB_STATUS, JOB_TONE, listJobCards, type JobStatus } from "@/lib/data/workshop";
import { formatMoney } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Badge, ButtonLink, EmptyState, PageHeader, SearchBar, cardClass, tdClass, thClass } from "@/components/ui";
import { LinkTabs } from "../finance/finance-ui";


async function WorkshopContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ q?: string; status?: string }> }) {
  const [{ company }, { q = "", status }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "workshop");
  const base = `/c/${slug}/workshop`;
  const all = await listJobCards(slug);
  const tab = status && status in JOB_STATUS ? (status as JobStatus) : status === "all" ? "all" : "active";
  const needle = q.trim().toLowerCase();
  const shown = all
    .filter((j) => (tab === "all" ? true : tab === "active" ? j.status === "OPEN" || j.status === "IN_PROGRESS" : j.status === tab))
    .filter((j) => !needle || [j.number, j.customerName, j.vessel?.name ?? "", j.complaint, j.technician ?? ""].some((t) => t.toLowerCase().includes(needle)));
  const count = (s: JobStatus) => all.filter((j) => j.status === s).length;

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Job cards"
        description="Work done on boats: what was asked, what was done, parts and labour. Invoice from here, or from the offer if the job came from one."
        action={<ButtonLink icon={Plus} href={`${base}/new`}>New job card</ButtonLink>}
      />
      <p className="mt-4 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
        <span className="font-medium text-navy">Offer or job card?</span> An <span className="font-medium text-navy">offer</span> gives the customer a price to approve
        before work. A <span className="font-medium text-navy">job card</span> records work on a boat. Accepted offer → &ldquo;Start job card&rdquo; on the offer. Small repair →
        job card directly.
      </p>
      <div className="mt-6 space-y-4">
        <LinkTabs
          active={tab}
          tabs={[
            { key: "active", label: `Open & in progress (${count("OPEN") + count("IN_PROGRESS")})`, href: base },
            { key: "DONE", label: `Done (${count("DONE")})`, href: `${base}?status=DONE` },
            { key: "CANCELLED", label: `Cancelled (${count("CANCELLED")})`, href: `${base}?status=CANCELLED` },
            { key: "all", label: `All (${all.length})`, href: `${base}?status=all` },
          ]}
        />
        <SearchBar action={base} defaultValue={q} placeholder="Search by number, customer, vessel, work or technician" keep={{ status }} />
      </div>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {shown.length === 0 ? (
          <EmptyState icon={Hammer} title="No job cards here" description="Open a job card when a boat comes in for work." />
        ) : (
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Job card</th>
                <th className={thClass}>Opened</th>
                <th className={thClass}>Vessel · customer</th>
                <th className={thClass}>Work</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Total excl. VAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((j) => (
                <tr key={j.id} className="hover:bg-surface-2/60">
                  <td className={tdClass}>
                    <Link href={`${base}/${j.id}`} className="font-mono text-xs font-medium text-brand hover:underline">
                      {j.number}
                    </Link>
                    {j.offer && <span className="block text-xs text-muted">from {j.offer.number}</span>}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-muted`}>{dayFormat.format(j.openedAt)}</td>
                  <td className={tdClass}>
                    <span className="font-medium text-navy">{j.vessel?.name ?? "—"}</span>
                    <span className="block text-xs text-muted">{j.customerName}</span>
                  </td>
                  <td className={`${tdClass} max-w-sm truncate text-muted`}>{j.complaint}</td>
                  <td className={tdClass}>
                    <Badge tone={JOB_TONE[j.status]}>{JOB_STATUS[j.status]}</Badge>
                    {j.invoices.length > 0 && <span className="ml-2 text-xs text-muted">invoiced</span>}
                  </td>
                  <td className={`${tdClass} tabular text-right font-semibold`}>{formatMoney(j.totalHT)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function WorkshopPage({ params, searchParams }: PageProps<"/c/[company]/workshop">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading job cards…</p>}>
      <WorkshopContent params={params} searchParams={searchParams as Promise<{ q?: string; status?: string }>} />
    </Suspense>
  );
}
