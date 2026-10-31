import { Suspense } from "react";
import { Hammer, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { JOB_STATUS, listJobCards, type JobStatus } from "@/lib/data/workshop";
import { COMPANIES, canAccessModule } from "@/lib/permissions";
import { JobCardDialog, JobCardTile, withParams } from "@/components/job-dialogs";
import { ButtonLink, EmptyState, PageHeader, SearchBar, cardClass } from "@/components/ui";
import { LinkTabs } from "../finance/finance-ui";


type Search = { q?: string; status?: string; view?: string; invoice?: string };

async function WorkshopContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, { q = "", status, view, invoice }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "workshop");
  const base = `/c/${slug}/workshop`;
  const all = await listJobCards(slug);
  const tab = status && status in JOB_STATUS ? (status as JobStatus) : status === "all" ? "all" : "active";
  const needle = q.trim().toLowerCase();
  const shown = all
    .filter((j) => (tab === "all" ? true : tab === "active" ? j.status === "OPEN" || j.status === "IN_PROGRESS" : j.status === tab))
    .filter((j) => !needle || [j.number, j.customerName, j.vessel?.name ?? "", j.complaint, j.technician ?? ""].some((t) => t.toLowerCase().includes(needle)));
  const count = (s: JobStatus) => all.filter((j) => j.status === s).length;
  // This list, as it is now (search and tab), so a pop-up closes back to it.
  const here = withParams(base, { q: q || null, status: status ?? null });

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Job cards"
        description="Work on boats. Click a card to see it all and act on it without leaving this page."
        action={<ButtonLink icon={Plus} href={`${base}/new`}>New job card</ButtonLink>}
      />
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
      {shown.length === 0 ? (
        <div className={`${cardClass} mt-4`}>
          <EmptyState icon={Hammer} title="No job cards here" description="Open a job card when a boat comes in for work." />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((j) => (
            <JobCardTile key={j.id} slug={slug} job={j} openHref={withParams(here, { view: j.id })} />
          ))}
        </div>
      )}
      {view && (
        <JobCardDialog
          slug={slug}
          id={view}
          closeHref={here}
          selfHref={withParams(here, { view })}
          canInvoice={canAccessModule(user, slug, "invoices")}
          invoicing={!!invoice}
        />
      )}
    </>
  );
}

export default function WorkshopPage({ params, searchParams }: PageProps<"/c/[company]/workshop">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading job cards…</p>}>
      <WorkshopContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
