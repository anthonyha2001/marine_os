import type { Ledger } from "@/lib/data/ledger";
import { dayFormat } from "@/lib/dates";
import { vatReport, type Period } from "@/lib/ledger/reports";
import { formatMoney, round2 } from "@/lib/money";
import { formatLbp } from "@/lib/pos";
import { cardClass, inputClass, secondaryButton, tdClass, thClass } from "@/components/ui";

const lbp = (usd: number, rate: number) => Math.round(usd * rate);

/**
 * VAT return in Lebanese pounds: the period's VAT figures converted at the rate the user
 * enters (the official rate for the declaration), with every document behind them.
 */
export function VatLbp({ ledger, period, rate, base, fromStr, toStr }: { ledger: Ledger; period: Period; rate: number | null; base: string; fromStr: string; toStr: string }) {
  const v = vatReport(ledger, period);
  const kinds = new Map(ledger.accounts.map((a) => [a.id, a.kind]));
  const docs = ledger.entries
    .filter((e) => (!period.from || e.date >= period.from) && (!period.to || e.date <= period.to))
    .map((e) => {
      let ht = 0;
      let vatOut = 0;
      let vatIn = 0;
      for (const l of e.lines) {
        const k = kinds.get(l.accountId);
        if (k === "VAT_OUT") vatOut += l.credit - l.debit;
        else if (k === "VAT_IN") vatIn += l.debit - l.credit;
        else if (k === "SALES") ht += l.credit - l.debit;
        else if (k === "PURCHASES" || k === "EXPENSE") ht += l.debit - l.credit;
      }
      return { id: e.id, date: e.date, number: e.number, memo: e.memo, ht: round2(ht), vatOut: round2(vatOut), vatIn: round2(vatIn) };
    })
    .filter((d) => d.vatOut !== 0 || d.vatIn !== 0);

  return (
    <div className="space-y-6">
      <form action={base} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="r" value="vatlbp" />
        <input type="hidden" name="from" value={fromStr} />
        <input type="hidden" name="to" value={toStr} />
        <label className="text-xs font-medium text-muted">
          Rate for the declaration (LBP per USD)
          <input name="rate" type="number" min="1" step="1" required defaultValue={rate ?? ""} placeholder="e.g. 89500" className={`${inputClass} mt-1 h-9 w-56`} />
        </label>
        <button type="submit" className={`${secondaryButton} h-9`}>
          Convert
        </button>
      </form>
      {!rate ? (
        <p className="text-sm text-muted">Enter the exchange rate to use for this declaration.</p>
      ) : (
        <>
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thClass} />
                  <th className={`${thClass} text-right`}>USD</th>
                  <th className={`${thClass} text-right`}>LBP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(
                  [
                    ["Taxable sales (excl. VAT)", v.sales],
                    ["Output VAT (collected)", v.collected],
                    ["Taxable purchases (excl. VAT)", v.purchases],
                    ["Input VAT (recoverable)", v.recoverable],
                  ] as [string, number][]
                ).map(([label, usd]) => (
                  <tr key={label}>
                    <td className={`${tdClass} text-navy`}>{label}</td>
                    <td className={`${tdClass} tabular text-right`}>{formatMoney(usd)}</td>
                    <td className={`${tdClass} tabular text-right font-medium`}>{formatLbp(lbp(usd, rate))}</td>
                  </tr>
                ))}
                <tr className="bg-surface-2 font-semibold text-navy">
                  <td className={tdClass}>{v.net >= 0 ? "VAT payable" : "VAT credit to carry forward"}</td>
                  <td className={`${tdClass} tabular text-right`}>{formatMoney(Math.abs(v.net))}</td>
                  <td className={`${tdClass} tabular text-right`}>{formatLbp(lbp(Math.abs(v.net), rate))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={`${cardClass} overflow-x-auto`}>
            <h3 className="border-b border-border px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted">Documents with VAT ({docs.length})</h3>
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Document</th>
                  <th className={`${thClass} text-right`}>Excl. VAT (LBP)</th>
                  <th className={`${thClass} text-right`}>Output VAT (LBP)</th>
                  <th className={`${thClass} text-right`}>Input VAT (LBP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{dayFormat.format(d.date)}</td>
                    <td className={tdClass}>
                      <span className="font-mono text-xs text-muted">{d.number}</span> {d.memo}
                    </td>
                    <td className={`${tdClass} tabular text-right`}>{formatLbp(lbp(d.ht, rate))}</td>
                    <td className={`${tdClass} tabular text-right`}>{d.vatOut ? formatLbp(lbp(d.vatOut, rate)) : "—"}</td>
                    <td className={`${tdClass} tabular text-right`}>{d.vatIn ? formatLbp(lbp(d.vatIn, rate)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Amounts are kept in USD and converted at the rate above. Print this page (Ctrl+P) to keep it with the declaration.</p>
        </>
      )}
    </div>
  );
}
