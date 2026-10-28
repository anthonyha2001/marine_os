import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSignature, FileText, HandCoins } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { listMoneyAccounts } from "@/lib/data/ledger";
import { getPayrollRun, outstandingAdvances } from "@/lib/data/payroll";
import { formatMoney, round2 } from "@/lib/money";
import { PAY_FREQUENCIES, RUN_STATUS } from "@/lib/payroll";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { Badge, PageHeader, cardClass, primaryButton, secondaryButton, tdClass, thClass } from "@/components/ui";
import { PayrollGrid } from "./payroll-grid";
import { PayForm, RunActions } from "./run-actions";

type Search = { saved?: string; paid?: string; pay?: string };
const TONE = { DRAFT: "gray", APPROVED: "amber", PAID: "green" } as const;

async function RunDetail({ params, searchParams }: { params: Promise<{ company: string; runId: string }>; searchParams: Promise<Search> }) {
  const [{ company, runId }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "payroll");
  const run = await getPayrollRun(slug, runId);
  if (!run) notFound();
  const base = `/c/${slug}/payroll/${run.id}`;
  const advances = run.status === "DRAFT" ? await outstandingAdvances(slug) : null;
  const owed = (employeeId: string, name: string) =>
    advances ? Math.max(0, round2((advances.byName.get(name.trim().toLowerCase()) ?? 0) - (advances.repaid.get(employeeId) ?? 0))) : 0;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Payroll ${run.number}`}
        title={run.label}
        description={`${PAY_FREQUENCIES[run.frequency]} · ${dayFormat.format(run.periodStart)} → ${dayFormat.format(run.periodEnd)} · ${run.lines.length} employee${run.lines.length === 1 ? "" : "s"}`}
        action={
          <>
            <a href={`${base}/sheet`} target="_blank" rel="noopener" className={secondaryButton}>
              <FileSignature className="size-4" aria-hidden /> Signature sheet
            </a>
            <a href={`${base}/payslips`} target="_blank" rel="noopener" className={secondaryButton}>
              <FileText className="size-4" aria-hidden /> Payslips
            </a>
            {run.status === "APPROVED" && (
              <Link href={`${base}?pay=1`} scroll={false} className={primaryButton}>
                <HandCoins className="size-4" aria-hidden /> Pay
              </Link>
            )}
            <RunActions companySlug={slug} runId={run.id} status={run.status} label={run.label} />
          </>
        }
      />
      {(search.saved || search.paid) && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          {search.paid ? "Payroll paid and posted to the accounts." : "Payroll saved."}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <Badge tone={TONE[run.status]}>{RUN_STATUS[run.status]}</Badge>
        {run.status === "DRAFT" && <span>Adjust the amounts, save, then approve.</span>}
        {run.status === "APPROVED" && <span>Print the signature sheet for staff to sign, then record the payment.</span>}
        {run.status === "PAID" && run.payDate && (
          <span>
            Paid on {dayFormat.format(run.payDate)} from {run.moneyAccount}
          </span>
        )}
      </div>

      <div className="mt-6">
        {run.status === "DRAFT" ? (
          <PayrollGrid
            key={run.lines.map((l) => l.id).join()}
            companySlug={slug}
            runId={run.id}
            notes={run.notes}
            lines={run.lines.map((l) => ({ ...l, owedAdvance: owed(l.employeeId, l.name) }))}
          />
        ) : (
          <>
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr>
                    <th className={thClass}>Employee</th>
                    <th className={`${thClass} text-right`}>Base</th>
                    <th className={`${thClass} text-right`}>Bonus</th>
                    <th className={`${thClass} text-right`}>Overtime</th>
                    <th className={`${thClass} text-right`}>Deductions</th>
                    <th className={`${thClass} text-right`}>Advance back</th>
                    <th className={`${thClass} text-right`}>Net pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {run.lines.map((l) => (
                    <tr key={l.id}>
                      <td className={tdClass}>
                        <span className="font-medium text-navy">{l.name}</span>
                        {l.position && <span className="block text-xs text-muted">{l.position}</span>}
                        {l.note && <span className="block text-xs text-muted">{l.note}</span>}
                      </td>
                      {[l.baseSalary, l.bonus, l.overtime, l.deductions, l.advance].map((v, i) => (
                        <td key={i} className={`${tdClass} tabular text-right ${v ? "" : "text-slate-300"}`}>
                          {v ? formatMoney(v) : "—"}
                        </td>
                      ))}
                      <td className={`${tdClass} tabular text-right font-semibold text-navy`}>{formatMoney(l.net)}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-2 font-semibold text-navy">
                    <td className={tdClass} colSpan={6}>
                      Total · salary cost {formatMoney(run.totalGross)}
                      {run.totalAdvance > 0 && ` · advances back ${formatMoney(run.totalAdvance)}`}
                    </td>
                    <td className={`${tdClass} tabular text-right`}>{formatMoney(run.totalNet)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {run.notes && <p className="mt-4 text-sm text-muted">Notes: {run.notes}</p>}
          </>
        )}
      </div>

      {search.pay && run.status === "APPROVED" && (
        <Modal title={`Pay ${run.label}`} closeHref={base} size="md">
          <PayForm key={crypto.randomUUID()} companySlug={slug} runId={run.id} total={run.totalNet} accounts={await listMoneyAccounts(slug)} />
        </Modal>
      )}
    </>
  );
}

export default function PayrollRunPage({ params, searchParams }: PageProps<"/c/[company]/payroll/[runId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading payroll…</p>}>
      <RunDetail params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
