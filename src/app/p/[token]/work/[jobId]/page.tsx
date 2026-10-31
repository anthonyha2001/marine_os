import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, FileText, MessageCircle, Wrench } from "lucide-react";
import { dayFormat } from "@/lib/dates";
import { JOB_STAGES, jobStage, portalCustomer, portalJob } from "@/lib/data/portal";
import { COMPANIES } from "@/lib/permissions";
import { secondaryButton } from "@/components/ui";
import { Card, JobTrack, PageHead } from "../../_parts";

const KIND = { PART: "Part", LABOR: "Labour", SERVICE: "Service" } as const;

async function Job({ params }: { params: Promise<{ token: string; jobId: string }> }) {
  const { token, jobId } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const job = await portalJob(customer.id, jobId);
  if (!job) notFound();
  const base = `/p/${token}`;
  const stage = jobStage(job);

  return (
    <>
      <Link href={`${base}/work`} className="text-sm text-brand hover:underline">
        ← Work
      </Link>
      <div className="mt-3">
        <PageHead
          title={job.vessel?.name ?? `Job ${job.number}`}
          sub={`${job.number} · ${COMPANIES[job.company].name} · opened ${dayFormat.format(job.openedAt)}`}
          action={
            <Link href={`${base}/messages/new?subject=${encodeURIComponent(`About ${job.number}`)}&company=${job.company}`} className={secondaryButton}>
              <MessageCircle className="size-4" aria-hidden /> Ask about this job
            </Link>
          }
        />
      </div>

      <div className="space-y-6">
        <Card>
          <div className="space-y-3 p-5">
            <JobTrack stage={stage} />
            <p className="text-sm text-muted">
              {stage === 0 && "We have your request and will start soon."}
              {stage === 1 && `Our team is working on it${job.technician ? ` (${job.technician})` : ""}.`}
              {stage === 2 && `Ready${job.completedAt ? ` since ${dayFormat.format(job.completedAt)}` : ""}. The invoice follows.`}
              {stage === 3 && "Finished and invoiced. Thank you!"}
              {job.dueDate && stage < 2 && ` Planned for ${dayFormat.format(job.dueDate)}.`}
            </p>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="What you asked for" icon={ClipboardList}>
            <p className="whitespace-pre-line p-4 text-sm text-navy">{job.complaint}</p>
          </Card>
          <Card title="What we did" icon={Wrench}>
            <p className="whitespace-pre-line p-4 text-sm text-navy">{job.workDone || (stage < 2 ? "Filled in when the work is done." : "—")}</p>
          </Card>
        </div>

        {job.lines.length > 0 && (
          <Card title="Parts and work" icon={Wrench}>
            <ul className="divide-y divide-border">
              {job.lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-navy">{l.title}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {KIND[l.kind as keyof typeof KIND] ?? l.kind} · {l.quantity}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {job.invoices.length > 0 && (
          <Card title="Invoices" icon={FileText}>
            <ul className="divide-y divide-border">
              {job.invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium text-navy">{i.number}</span>
                  <a href={`${base}/invoices/${i.id}/pdf`} target="_blank" rel="noopener" className="text-xs font-medium text-brand hover:underline">
                    Open PDF
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <p className="text-center text-xs text-muted">Status: {JOB_STAGES[stage]}</p>
      </div>
    </>
  );
}

export default function PortalJob({ params }: PageProps<"/p/[token]/work/[jobId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Job params={params} />
    </Suspense>
  );
}
