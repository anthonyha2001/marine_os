import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ReceiptText, ShieldPlus } from "lucide-react";
import { NewWarrantyDialog } from "@/components/create-dialogs";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { getCatalogue } from "@/lib/data/inventory";
import { averageCosts } from "@/lib/costing";
import { companyIdFor } from "@/lib/data/inventory";
import { jobProfit } from "@/lib/data/profit";
import { getCompanyProfile, listCustomers } from "@/lib/data/sales";
import { vesselOptions } from "@/lib/data/vessels";
import { JOB_STATUS, JOB_TONE, getJobCard } from "@/lib/data/workshop";
import { VAT_RATE, formatMoney, round2 } from "@/lib/money";
import { COMPANIES, canAccessModule } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { Badge, PageHeader, cardClass, primaryButton, secondaryButton, tdClass, thClass } from "@/components/ui";
import { JobCardForm } from "../job-card-form";
import { InvoiceJobForm, JobActions } from "./job-actions";

const KIND = { PART: "Part", LABOR: "Labour", SERVICE: "Service" } as const;

async function JobDetail({ params, searchParams }: { params: Promise<{ company: string; jobId: string }>; searchParams: Promise<{ saved?: string; invoice?: string; create?: string }> }) {
  const [{ company, jobId }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "workshop");
  const job = await getJobCard(slug, jobId);
  if (!job) notFound();
  const base = `/c/${slug}/workshop/${job.id}`;
  const editable = job.status === "OPEN" || job.status === "IN_PROGRESS";
  const canInvoice = canAccessModule(user, slug, "invoices");
  const billTTC = round2(job.toInvoiceHT * (job.applyVat ? 1 + VAT_RATE : 1));
  const [vessels, customers, catalogue] = editable ? await Promise.all([vesselOptions(), listCustomers(), getCatalogue()]) : [[], [], []];
  // Profit is for managers and accountants, not the workshop.
  const showProfit = canAccessModule(user, slug, "accounting");
  const profit = showProfit
    ? jobProfit(job, await averageCosts(await companyIdFor(slug)), (await getCompanyProfile(slug)).labourCostPerHour)
    : null;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Job card`}
        title={job.number}
        description={`${job.vessel?.name ? `${job.vessel.name} · ` : ""}${job.customerName} · opened ${dayFormat.format(job.openedAt)}${job.technician ? ` · ${job.technician}` : ""}`}
        action={
          <>
            <a href={`${base}/pdf`} target="_blank" rel="noopener" className={secondaryButton}>
              <FileText className="size-4" aria-hidden /> Job card PDF
            </a>
            {canInvoice && job.status !== "CANCELLED" && job.toInvoiceHT > 0 && (
              <Link href={`${base}?invoice=1`} scroll={false} className={primaryButton}>
                <ReceiptText className="size-4" aria-hidden /> Create invoice
              </Link>
            )}
            <Link href={`${base}?create=warranty`} scroll={false} className={secondaryButton}>
              <ShieldPlus className="size-4" aria-hidden /> Add warranty
            </Link>
            <JobActions companySlug={slug} jobId={job.id} number={job.number} status={job.status} hasInvoices={job.invoices.length > 0} />
          </>
        }
      />
      {search.saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Job card saved.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <Badge tone={JOB_TONE[job.status]}>{JOB_STATUS[job.status]}</Badge>
        {job.vessel && (
          <Link href={`/c/${slug}/vessels/${job.vessel.id}`} className="text-brand hover:underline">
            Vessel history →
          </Link>
        )}
        {job.offer && (
          <span className="text-muted">
            From offer{" "}
            <Link href={`/c/${slug}/offers/${job.offer.id}`} className="font-mono text-brand hover:underline">
              {job.offer.number}
            </Link>{" "}
            — the offer is billed through its payment plan; only extra work is invoiced here.
          </span>
        )}
        {job.invoices.map((i) => (
          <Link key={i.id} href={`/c/${slug}/invoices/${i.id}`} className="font-mono text-xs text-brand hover:underline">
            {i.number} · {formatMoney(i.totalTTC)}
          </Link>
        ))}
      </div>

      {profit && (
        <div className={`${cardClass} mt-4 grid gap-4 p-4 text-sm sm:grid-cols-5`}>
          {(
            [
              ["Work billed (excl. VAT)", formatMoney(profit.revenue)],
              ["Parts at cost", formatMoney(profit.parts)],
              [`Labour ${profit.hours} h at cost`, formatMoney(profit.labour)],
              ["Profit", formatMoney(profit.profit)],
              ["Margin", profit.margin === null ? "—" : `${profit.margin}%`],
            ] as [string, string][]
          ).map(([label, value], i) => (
            <div key={label}>
              <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
              <p className={`tabular mt-0.5 font-semibold ${i === 3 && profit.profit < 0 ? "text-danger" : "text-navy"}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        {editable ? (
          <JobCardForm
            key={job.lines.map((l) => l.id).join()}
            companySlug={slug}
            job={job}
            vessels={vessels}
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            catalogue={catalogue.filter((c) => c.active).map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type, priceHT: c.priceHT }))}
          />
        ) : (
          <div className="space-y-6">
            <section className={`${cardClass} grid gap-4 p-5 sm:grid-cols-2`}>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Work requested</p>
                <p className="mt-1 whitespace-pre-line text-sm text-navy">{job.complaint}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Work done</p>
                <p className="mt-1 whitespace-pre-line text-sm text-navy">{job.workDone || "—"}</p>
              </div>
              <p className="text-sm text-muted">Engine hours: {job.engineHours ?? "—"}</p>
              <p className="text-sm text-muted">Completed: {job.completedAt ? dayFormat.format(job.completedAt) : "—"}</p>
            </section>
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr>
                    <th className={thClass}>Type</th>
                    <th className={thClass}>Description</th>
                    <th className={`${thClass} text-right`}>Qty</th>
                    <th className={`${thClass} text-right`}>Unit price</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                    <th className={thClass}>Billing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {job.lines.map((l) => (
                    <tr key={l.id}>
                      <td className={`${tdClass} text-muted`}>{KIND[l.kind]}</td>
                      <td className={`${tdClass} font-medium text-navy`}>{l.title}</td>
                      <td className={`${tdClass} tabular text-right`}>{l.quantity}</td>
                      <td className={`${tdClass} tabular text-right`}>{formatMoney(l.unitPrice)}</td>
                      <td className={`${tdClass} tabular text-right font-medium`}>{formatMoney(l.lineTotal)}</td>
                      <td className={`${tdClass} text-xs text-muted`}>{l.invoice ? l.invoice.number : l.billable ? "to invoice" : "covered by offer"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {search.invoice && canInvoice && job.toInvoiceHT > 0 && (
        <Modal title={`Invoice ${job.number}`} closeHref={base} size="md">
          <InvoiceJobForm key={crypto.randomUUID()} companySlug={slug} jobId={job.id} amount={`${formatMoney(job.toInvoiceHT)} excl. VAT · ${formatMoney(billTTC)} to pay`} />
        </Modal>
      )}
      {search.create === "warranty" && <NewWarrantyDialog slug={slug} closeHref={base} jobId={job.id} />}
    </>
  );
}

export default function JobCardPage({ params, searchParams }: PageProps<"/c/[company]/workshop/[jobId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <JobDetail params={params} searchParams={searchParams as Promise<{ saved?: string; invoice?: string; create?: string }>} />
    </Suspense>
  );
}
