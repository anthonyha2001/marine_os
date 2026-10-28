import { Suspense } from "react";
import Link from "next/link";
import { Banknote, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { listEmployees, listPayrollRuns } from "@/lib/data/payroll";
import { formatMoney, round2 } from "@/lib/money";
import { PAY_FREQUENCIES, RUN_STATUS } from "@/lib/payroll";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { Badge, ButtonLink, EmptyState, PageHeader, StatCard, cardClass, tdClass, thClass } from "@/components/ui";
import { NewRunForm } from "./new-run-form";

const TONE = { DRAFT: "gray", APPROVED: "amber", PAID: "green" } as const;

async function PayrollContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ new?: string }> }) {
  const [{ company }, { new: creating }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "payroll");
  const base = `/c/${slug}/payroll`;
  const [runs, staff] = await Promise.all([listPayrollRuns(slug), listEmployees(slug)]);
  const active = staff.filter((e) => e.active);
  const year = new Date().getUTCFullYear();
  const paidThisYear = round2(runs.filter((r) => r.status === "PAID" && r.periodStart.getUTCFullYear() === year).reduce((s, r) => s + r.totalNet, 0));
  const waiting = runs.filter((r) => r.status !== "PAID");

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Payroll"
        description="One payroll per month or per week: adjust bonuses and deductions, approve, print the sheet for staff to sign, then pay."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New payroll</ButtonLink>}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={`Paid in ${year}`} value={formatMoney(paidThisYear)} icon={Banknote} hint="net salaries paid out" />
        <StatCard label="Waiting to be paid" value={formatMoney(round2(waiting.reduce((s, r) => s + r.totalNet, 0)))} hint={`${waiting.length} payroll${waiting.length === 1 ? "" : "s"} in draft or approved`} />
        <StatCard label="Active staff" value={String(active.length)} href={`/c/${slug}/staff`} hint="manage on the Staff page" />
      </div>

      <div className={`${cardClass} mt-6 overflow-x-auto`}>
        {runs.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payroll yet"
            description={active.length ? "Start the first one for this month or week." : "Add your staff first, then start a payroll."}
            action={!active.length && <ButtonLink href={`/c/${slug}/staff?new=1`} variant="secondary">Add staff</ButtonLink>}
          />
        ) : (
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Payroll</th>
                <th className={thClass}>Period</th>
                <th className={thClass}>Frequency</th>
                <th className={`${thClass} text-right`}>Staff</th>
                <th className={`${thClass} text-right`}>Net to pay</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/60">
                  <td className={tdClass}>
                    <Link href={`${base}/${r.id}`} className="font-mono text-xs font-medium text-brand hover:underline">
                      {r.number}
                    </Link>
                  </td>
                  <td className={`${tdClass} font-medium text-navy`}>{r.label}</td>
                  <td className={`${tdClass} text-muted`}>{PAY_FREQUENCIES[r.frequency]}</td>
                  <td className={`${tdClass} tabular text-right`}>{r.lines.length}</td>
                  <td className={`${tdClass} tabular text-right font-semibold`}>{formatMoney(r.totalNet)}</td>
                  <td className={tdClass}>
                    <Badge tone={TONE[r.status]}>{RUN_STATUS[r.status]}</Badge>
                    {r.payDate && <span className="ml-2 text-xs text-muted">{dayFormat.format(r.payDate)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <Modal title="New payroll" closeHref={base} size="md">
          <NewRunForm
            key={crypto.randomUUID()}
            companySlug={slug}
            counts={{ MONTHLY: active.filter((e) => e.payFrequency === "MONTHLY").length, WEEKLY: active.filter((e) => e.payFrequency === "WEEKLY").length }}
          />
        </Modal>
      )}
    </>
  );
}

export default function PayrollPage({ params, searchParams }: PageProps<"/c/[company]/payroll">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading payroll…</p>}>
      <PayrollContent params={params} searchParams={searchParams as Promise<{ new?: string }>} />
    </Suspense>
  );
}
