import { Suspense } from "react";
import { CheckCheck } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { businessToday, dayFormat } from "@/lib/dates";
import { companyIdFor } from "@/lib/data/inventory";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, cardClass, inputClass, secondaryButton, tdClass, thClass } from "@/components/ui";
import { ReconcileForm, UndoReconciliation } from "./reconcile-form";

async function ReconcileContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ account?: string; done?: string }> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "accounting");
  const base = `/c/${slug}/finance/reconcile`;
  const companyId = await companyIdFor(slug);
  const banks = await prisma.ledgerAccount.findMany({ where: { companyId, kind: "BANK", active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  const account = banks.find((b) => b.id === search.account) ?? banks[0];

  if (!account) {
    return (
      <>
        <PageHeader eyebrow={`${COMPANIES[slug].name} · Finance`} title="Bank reconciliation" />
        <div className={`${cardClass} mt-6`}>
          <EmptyState icon={CheckCheck} title="No bank account" description="Add a bank account in the chart of accounts." />
        </div>
      </>
    );
  }

  // Read fresh (not cached): the tick state must be exact.
  const [open, done, history] = await Promise.all([
    prisma.journalLine.findMany({
      where: { accountId: account.id, reconciliationId: null },
      include: { entry: { select: { date: true, number: true, memo: true } } },
      orderBy: [{ entry: { date: "asc" } }, { entry: { number: "asc" } }],
    }),
    prisma.journalLine.aggregate({ where: { accountId: account.id, reconciliationId: { not: null } }, _sum: { debit: true, credit: true } }),
    prisma.bankReconciliation.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "desc" }, take: 12, include: { createdBy: { select: { name: true } }, _count: { select: { lines: true } } } }),
  ]);
  const opening = round2(Number(done._sum.debit ?? 0) - Number(done._sum.credit ?? 0));

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Finance`}
        title="Bank reconciliation"
        description="Match the bank statement with the books: tick each movement that appears on the statement until both balances agree. Unticked lines are not yet through the bank (e.g. a cheque not cashed)."
      />
      {search.done && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Reconciliation saved.
        </p>
      )}
      {banks.length > 1 && (
        <form action={base} className="mt-6 flex items-end gap-2">
          <label className="text-xs font-medium text-muted">
            Bank account
            <select name="account" defaultValue={account.id} className={`${inputClass} mt-1 h-9 w-72`}>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={`${secondaryButton} h-9`}>
            Show
          </button>
        </form>
      )}
      <h2 className="mt-6 text-lg font-semibold text-navy">
        {account.code} · {account.name}
      </h2>
      <div className="mt-4">
        <ReconcileForm
          key={`${account.id}-${open.length}-${history.length}`}
          companySlug={slug}
          accountId={account.id}
          openingBalance={opening}
          defaultDate={businessToday()}
          lines={open.map((l) => ({ id: l.id, date: l.entry.date.toISOString().slice(0, 10), number: l.entry.number, memo: l.description ?? l.entry.memo, debit: Number(l.debit), credit: Number(l.credit) }))}
        />
      </div>
      {history.length > 0 && (
        <section className={`${cardClass} mt-8 overflow-x-auto`}>
          <h2 className="border-b border-border px-4 py-3 font-semibold text-navy">Past reconciliations</h2>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={thClass}>Statement date</th>
                <th className={`${thClass} text-right`}>Statement balance</th>
                <th className={`${thClass} text-right`}>Lines</th>
                <th className={thClass}>By</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((h, i) => (
                <tr key={h.id}>
                  <td className={tdClass}>{dayFormat.format(h.statementDate)}</td>
                  <td className={`${tdClass} tabular text-right font-medium`}>{formatMoney(Number(h.statementBalance))}</td>
                  <td className={`${tdClass} tabular text-right`}>{h._count.lines}</td>
                  <td className={`${tdClass} text-muted`}>{h.createdBy.name}</td>
                  <td className={`${tdClass} text-right`}>{i === 0 && <UndoReconciliation companySlug={slug} reconciliationId={h.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

export default function ReconcilePage({ params, searchParams }: PageProps<"/c/[company]/finance/reconcile">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ReconcileContent params={params} searchParams={searchParams as Promise<{ account?: string; done?: string }>} />
    </Suspense>
  );
}
