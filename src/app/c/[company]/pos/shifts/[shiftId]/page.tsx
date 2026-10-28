import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { listSales, listShifts, shiftReport } from "@/lib/data/pos";
import { formatMoney } from "@/lib/money";
import { formatLbp, formatRate, hasPos, shiftDifference } from "@/lib/pos";
import { COMPANIES } from "@/lib/permissions";
import { Badge, PageHeader, StatCard, cardClass, primaryButton, tdClass, thClass } from "@/components/ui";

const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Beirut" });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" });

async function ShiftDetail({ params, searchParams }: { params: Promise<{ company: string; shiftId: string }>; searchParams: Promise<{ closed?: string }> }) {
  const [{ company, shiftId }, { closed }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "sales");
  if (!hasPos(slug)) notFound();
  const [shifts, sales] = await Promise.all([listShifts(slug), listSales(slug)]);
  const shift = shifts.find((s) => s.id === shiftId);
  if (!shift || (user.role === "CASHIER" && shift.cashierId !== user.id)) notFound();
  const { sales: own, refunds, summary, expected } = shiftReport(shift, sales);
  const diff = shiftDifference(shift);

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Z report`}
        title={`Shift ${shift.number}`}
        description={`${shift.cashierName} · opened ${stamp.format(shift.openedAt)}${shift.closedAt ? ` · closed ${stamp.format(shift.closedAt)}` : ""}`}
        action={
          <a href={`/c/${slug}/pos/shifts/${shift.id}/report?print=1`} target="_blank" rel="noopener" className={primaryButton}>
            <Printer className="size-4" aria-hidden /> Print Z report
          </a>
        }
      />
      {closed && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Shift closed.{" "}
          {diff === 0 ? "The till balanced." : diff !== null ? `A difference of ${formatMoney(Math.abs(diff))} (${diff < 0 ? "short" : "over"}) was booked in the accounts.` : ""}
        </p>
      )}
      <div className="mt-3">{shift.status === "OPEN" ? <Badge tone="green">Open</Badge> : <Badge tone="gray">Closed</Badge>}</div>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        <StatCard label="Net sales" value={formatMoney(summary.net)} hint={`${summary.count} sales${summary.refunded ? ` · ${formatMoney(summary.refunded)} refunded` : ""}`} />
        <StatCard label="Cash USD taken" value={formatMoney(summary.methods.usd)} />
        <StatCard label="Cash LBP taken" value={formatLbp(summary.methods.lbp)} />
        <StatCard label="Card" value={formatMoney(summary.methods.card)} />
        <StatCard label="VAT collected" value={formatMoney(summary.vat)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className={`${cardClass} overflow-hidden`}>
          <h2 className="border-b border-border px-4 py-3 font-semibold text-navy">Cash drawer</h2>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={thClass} />
                <th className={`${thClass} text-right`}>USD</th>
                <th className={`${thClass} text-right`}>LBP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className={tdClass}>Opening float</td>
                <td className={`${tdClass} tabular text-right`}>{formatMoney(shift.openingUsd)}</td>
                <td className={`${tdClass} tabular text-right`}>{formatLbp(shift.openingLbp)}</td>
              </tr>
              <tr>
                <td className={tdClass}>Cash taken (net of change and refunds)</td>
                <td className={`${tdClass} tabular text-right`}>{formatMoney(summary.methods.usd)}</td>
                <td className={`${tdClass} tabular text-right`}>{formatLbp(summary.methods.lbp)}</td>
              </tr>
              <tr className="bg-surface-2/60 font-semibold text-navy">
                <td className={tdClass}>Expected in the drawer</td>
                <td className={`${tdClass} tabular text-right`}>{formatMoney(expected.usd)}</td>
                <td className={`${tdClass} tabular text-right`}>{formatLbp(expected.lbp)}</td>
              </tr>
              {shift.status === "CLOSED" && (
                <>
                  <tr>
                    <td className={tdClass}>Counted</td>
                    <td className={`${tdClass} tabular text-right`}>{formatMoney(shift.countedUsd ?? 0)}</td>
                    <td className={`${tdClass} tabular text-right`}>{formatLbp(shift.countedLbp ?? 0)}</td>
                  </tr>
                  <tr className={diff === 0 ? "text-success" : "text-danger"}>
                    <td className={`${tdClass} font-semibold`}>Difference</td>
                    <td className={`${tdClass} tabular text-right`}>{formatMoney((shift.countedUsd ?? 0) - (shift.expectedUsd ?? 0))}</td>
                    <td className={`${tdClass} tabular text-right`}>{formatLbp((shift.countedLbp ?? 0) - (shift.expectedLbp ?? 0))}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          {shift.status === "CLOSED" && diff !== null && (
            <p className="border-t border-border px-4 py-3 text-sm text-muted">
              In USD at {formatRate(shift.closeRate ?? 0)}:{" "}
              <span className="font-semibold text-navy">{diff === 0 ? "balanced" : `${diff < 0 ? "short" : "over"} ${formatMoney(Math.abs(diff))}`}</span>
              {shift.notes && <span className="mt-1 block">Note: {shift.notes}</span>}
            </p>
          )}
        </section>

        <section className={`${cardClass} overflow-hidden`}>
          <h2 className="border-b border-border px-4 py-3 font-semibold text-navy">Products sold</h2>
          {summary.products.length === 0 ? (
            <p className="p-4 text-sm text-muted">Nothing sold.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {summary.products.map((p) => (
                <li key={p.code} className="flex justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate text-navy">
                    <span className="tabular font-semibold">{p.quantity}×</span> {p.name}
                  </span>
                  <span className="tabular text-muted">{formatMoney(p.amountHT)} excl. VAT</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={`${cardClass} mt-6 overflow-x-auto`}>
        <h2 className="border-b border-border px-4 py-3 font-semibold text-navy">Sales in this shift</h2>
        <table className="w-full min-w-[40rem] text-sm">
          <tbody className="divide-y divide-border">
            {own.map((s) => (
              <tr key={s.id}>
                <td className={tdClass}>
                  <Link href={`/c/${slug}/pos/sales/${s.id}`} className="font-mono text-xs text-brand hover:underline">
                    {s.number}
                  </Link>
                </td>
                <td className={`${tdClass} text-muted`}>{time.format(s.createdAt)}</td>
                <td className={tdClass}>{s.customerName}</td>
                <td className={`${tdClass} tabular text-right font-medium`}>{formatMoney(s.totalTTC)}</td>
              </tr>
            ))}
            {refunds.map((r) => (
              <tr key={r.id} className="text-danger">
                <td className={`${tdClass} font-mono text-xs`}>{r.number}</td>
                <td className={tdClass}>{time.format(r.createdAt)}</td>
                <td className={tdClass}>Refund on {r.sale.number}</td>
                <td className={`${tdClass} tabular text-right font-medium`}>− {formatMoney(r.totalTTC)}</td>
              </tr>
            ))}
            {own.length + refunds.length === 0 && (
              <tr>
                <td className="p-6 text-center text-muted">No sales yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

export default function ShiftPage({ params, searchParams }: PageProps<"/c/[company]/pos/shifts/[shiftId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ShiftDetail params={params} searchParams={searchParams as Promise<{ closed?: string }>} />
    </Suspense>
  );
}
