import Link from "next/link";
import { ExternalLink, FileText, Hammer, ReceiptText } from "lucide-react";
import { createJobCardFromOffer } from "@/lib/actions/workshop";
import { dayFormat } from "@/lib/dates";
import { JOB_STATUS, JOB_TONE, getJobCard, type JobCardRow } from "@/lib/data/workshop";
import { VAT_RATE, formatMoney, round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";
import { InvoiceJobForm, JobActions, JobQuickActions } from "@/app/c/[company]/workshop/[jobId]/job-actions";
import { Modal } from "@/components/modal";
import { Badge, cardClass, primaryButton, secondaryButton, secondaryButtonSm } from "@/components/ui";

// Job cards in pop-ups, so quick actions never take you away from the page you are on.

const KIND = { PART: "Part", LABOR: "Labour", SERVICE: "Service" } as const;

/** Adds or replaces query values on a path ("/x?a=1" + {b: "2"} → "/x?a=1&b=2"). */
export function withParams(href: string, values: Record<string, string | null>) {
  const [path, query = ""] = href.split("?");
  const p = new URLSearchParams(query);
  for (const [k, v] of Object.entries(values)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}

/** One job card as a card: who, what, status, total, and quick buttons. */
export function JobCardTile({ slug, job, openHref }: { slug: CompanySlug; job: JobCardRow; openHref: string }) {
  const late = job.dueDate && (job.status === "OPEN" || job.status === "IN_PROGRESS") && job.dueDate.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);
  return (
    <article className={`${cardClass} flex flex-col transition hover:border-brand/40 hover:shadow-md`}>
      <Link href={openHref} scroll={false} data-nav-row className="block flex-1 rounded-t-xl p-4">
        <div className="flex items-start justify-between gap-2">
          <span>
            <span className="font-mono text-xs font-semibold text-brand">{job.number}</span>
            {job.offer && <span className="ml-2 text-xs text-muted">from {job.offer.number}</span>}
          </span>
          <Badge tone={JOB_TONE[job.status]}>{JOB_STATUS[job.status]}</Badge>
        </div>
        <p className="mt-2 font-semibold text-navy">{job.vessel?.name ?? job.customerName}</p>
        {job.vessel && <p className="text-xs text-muted">{job.customerName}</p>}
        <p className="mt-2 line-clamp-2 text-sm text-slate-700">{job.complaint}</p>
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span>Opened {dayFormat.format(job.openedAt)}</span>
          {job.dueDate && <span className={late ? "font-medium text-danger" : ""}>Due {dayFormat.format(job.dueDate)}</span>}
          {job.technician && <span>· {job.technician}</span>}
        </p>
      </Link>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2.5">
        <span className="tabular mr-auto text-sm font-semibold text-navy">
          {formatMoney(job.totalHT)}
          {job.invoices.length > 0 ? (
            <span className="ml-1.5 text-xs font-normal text-success">invoiced</span>
          ) : (
            job.toInvoiceHT > 0 && job.status === "DONE" && <span className="ml-1.5 text-xs font-normal text-warning">to invoice</span>
          )}
        </span>
        <JobQuickActions companySlug={slug} jobId={job.id} number={job.number} status={job.status} />
        <a href={`/c/${slug}/workshop/${job.id}/pdf`} target="_blank" rel="noopener" title="Job card PDF" aria-label={`${job.number} PDF`} className={secondaryButtonSm}>
          <FileText className="size-3.5" aria-hidden />
        </a>
      </div>
    </article>
  );
}

/** Everything about one job card, with its buttons. `selfHref` is the URL that shows this pop-up. */
export async function JobCardDialog({
  slug,
  id,
  closeHref,
  selfHref,
  canInvoice,
  invoicing,
}: {
  slug: CompanySlug;
  id: string;
  closeHref: string;
  selfHref: string;
  canInvoice: boolean;
  invoicing?: boolean;
}) {
  const job = await getJobCard(slug, id);
  if (!job) return null;
  const page = `/c/${slug}/workshop/${job.id}`;
  const billTTC = round2(job.toInvoiceHT * (job.applyVat ? 1 + VAT_RATE : 1));
  const mayInvoice = canInvoice && job.status !== "CANCELLED" && job.toInvoiceHT > 0;

  if (invoicing && mayInvoice)
    return (
      <Modal title={`Invoice ${job.number}`} closeHref={withParams(selfHref, { invoice: null })} size="md">
        <InvoiceJobForm
          key={crypto.randomUUID()}
          companySlug={slug}
          jobId={job.id}
          amount={`${formatMoney(job.toInvoiceHT)} excl. VAT · ${formatMoney(billTTC)} to pay`}
          returnTo={withParams(selfHref, { invoice: null })}
        />
      </Modal>
    );

  return (
    <Modal title={`Job card ${job.number}`} closeHref={closeHref} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={JOB_TONE[job.status]}>{JOB_STATUS[job.status]}</Badge>
          <span className="text-sm text-muted">
            {[job.vessel?.name, job.customerName, `opened ${dayFormat.format(job.openedAt)}`, job.technician].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className={`${cardClass} grid gap-4 p-4 text-sm sm:grid-cols-2`}>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Work requested</p>
            <p className="mt-1 whitespace-pre-line text-navy">{job.complaint}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Work done</p>
            <p className="mt-1 whitespace-pre-line text-navy">{job.workDone || "—"}</p>
          </div>
        </div>
        {job.lines.length > 0 && (
          <div className={`${cardClass} overflow-x-auto`} data-no-row-keys>
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {job.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-muted">{KIND[l.kind]}</td>
                    <td className="px-3 py-2 font-medium text-navy">{l.title}</td>
                    <td className="tabular px-3 py-2 text-right">{l.quantity}</td>
                    <td className="tabular px-3 py-2 text-right">{formatMoney(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted">
            Total excl. VAT <span className="tabular font-semibold text-navy">{formatMoney(job.totalHT)}</span>
            {job.toInvoiceHT > 0 && <> · to invoice <span className="tabular font-semibold text-navy">{formatMoney(job.toInvoiceHT)}</span></>}
          </span>
          {job.invoices.map((i) => (
            <Link key={i.id} href={`/c/${slug}/invoices/${i.id}`} className="font-mono text-xs text-brand hover:underline">
              {i.number} · {formatMoney(i.totalTTC)}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <JobActions companySlug={slug} jobId={job.id} number={job.number} status={job.status} hasInvoices={job.invoices.length > 0} />
          <a href={`${page}/pdf`} target="_blank" rel="noopener" className={secondaryButton}>
            <FileText className="size-4" aria-hidden /> PDF
          </a>
          {mayInvoice && (
            <Link href={withParams(selfHref, { invoice: "1" })} scroll={false} className={primaryButton}>
              <ReceiptText className="size-4" aria-hidden /> Create invoice
            </Link>
          )}
          <Link href={page} className={secondaryButton} title="Open the full job card to change lines and work done">
            <ExternalLink className="size-4" aria-hidden /> Edit lines
          </Link>
        </div>
      </div>
    </Modal>
  );
}

/** The job cards of one offer, with "Start job card" — all without leaving the offer. */
export function OfferJobsDialog({
  slug,
  offer,
  jobs,
  closeHref,
  selfHref,
}: {
  slug: CompanySlug;
  offer: { id: string; number: string; status: string };
  jobs: JobCardRow[];
  closeHref: string;
  selfHref: string;
}) {
  return (
    <Modal title={`Job cards for ${offer.number}`} closeHref={closeHref} size="xl">
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <p className="rounded-lg bg-surface-2 px-4 py-6 text-center text-sm text-muted">No job card for this offer yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {jobs.map((j) => (
              <JobCardTile key={j.id} slug={slug} job={j} openHref={withParams(selfHref, { job: j.id })} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted">{offer.status === "ACCEPTED" ? "The job card copies the offer's lines." : "A job card can be started once the offer is accepted."}</p>
          {offer.status === "ACCEPTED" && (
            <form action={createJobCardFromOffer.bind(null, slug, offer.id)}>
              <input type="hidden" name="returnTo" value={selfHref} />
              <button type="submit" className={primaryButton}>
                <Hammer className="size-4" aria-hidden /> {jobs.length ? "Start another job card" : "Start job card"}
              </button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
}
