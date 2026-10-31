import { Suspense } from "react";
import Link from "next/link";
import { dayFormat } from "@/lib/dates";
import { jobStage, portalCustomer, portalJobs } from "@/lib/data/portal";
import { COMPANIES } from "@/lib/permissions";
import { cardClass } from "@/components/ui";
import { Empty, JobTrack, PageHead } from "../_parts";

async function Work({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const jobs = await portalJobs(customer.id);
  const running = jobs.filter((j) => jobStage(j) < 2);
  const finished = jobs.filter((j) => jobStage(j) >= 2);

  const list = (rows: typeof jobs) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((j) => (
        <Link key={j.id} href={`/p/${token}/work/${j.id}`} className={`${cardClass} block space-y-4 p-4 transition hover:border-brand/40 hover:shadow-md`}>
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-navy">{j.vessel?.name ?? j.complaint}</span>
              <span className="line-clamp-2 block text-sm text-muted">{j.vessel ? j.complaint : ""}</span>
            </span>
            <span className="shrink-0 text-right text-xs text-muted">
              {j.number}
              <span className="block">{COMPANIES[j.company].name}</span>
            </span>
          </span>
          <JobTrack stage={jobStage(j)} />
          <span className="block text-xs text-muted">
            Opened {dayFormat.format(j.openedAt)}
            {j.completedAt && ` · ready ${dayFormat.format(j.completedAt)}`}
          </span>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <PageHead title="Work" sub="Follow every job on your boats, from the moment we receive it until it's invoiced." />
      {jobs.length === 0 ? (
        <div className={cardClass}>
          <Empty>No work yet. Book a service and it will show here.</Empty>
        </div>
      ) : (
        <div className="space-y-8">
          {running.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">In progress</h2>
              {list(running)}
            </section>
          )}
          {finished.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Finished</h2>
              {list(finished)}
            </section>
          )}
        </div>
      )}
    </>
  );
}

export default function PortalWork({ params }: PageProps<"/p/[token]/work">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Work params={params} />
    </Suspense>
  );
}
