"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { finishReconciliation, undoReconciliation, type ReconcileState } from "@/lib/actions/reconcile";
import { formatMoney, round2 } from "@/lib/money";
import { useFeedback } from "@/components/feedback";
import { FormMessage, Kbd, StickyActions, cardClass, inputClass, labelClass, primaryButton, secondaryButtonSm } from "@/components/ui";

type Line = { id: string; date: string; number: string; memo: string; debit: number; credit: number };
const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Tick every line that appears on the bank statement up to its date. When the ticked lines
 * plus what was reconciled before equal the statement's closing balance, it can be saved.
 */
export function ReconcileForm({ companySlug, accountId, openingBalance, lines, defaultDate }: { companySlug: string; accountId: string; openingBalance: number; lines: Line[]; defaultDate: string }) {
  const [state, formAction, pending] = useActionState<ReconcileState, FormData>(finishReconciliation.bind(null, companySlug), {});
  const [date, setDate] = useState(defaultDate);
  const [balance, setBalance] = useState("");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const visible = useMemo(() => lines.filter((l) => l.date <= date), [lines, date]);
  const cleared = round2(openingBalance + visible.filter((l) => ticked.has(l.id)).reduce((s, l) => s + l.debit - l.credit, 0));
  const statement = balance === "" ? null : Number(balance);
  const diff = statement === null ? null : round2(statement - cleared);
  const toggle = (id: string) =>
    setTicked((t) => {
      const n = new Set(t);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form
      action={(fd) => {
        fd.set("payload", JSON.stringify({ accountId, statementDate: date, statementBalance: Number(balance), lineIds: visible.filter((l) => ticked.has(l.id)).map((l) => l.id) }));
        return formAction(fd);
      }}
      data-save-shortcut
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Statement date *
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Closing balance on the statement *
          <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" className={`${inputClass} tabular`} />
        </label>
        <div className="text-sm">
          <p className="text-muted">Already reconciled: {formatMoney(openingBalance)}</p>
          <p className="text-muted">Cleared with ticks: {formatMoney(cleared)}</p>
          <p className={`font-semibold ${diff === 0 ? "text-success" : "text-danger"}`}>{diff === null ? "Enter the statement balance" : diff === 0 ? "Balanced ✓" : `Difference: ${formatMoney(diff)}`}</p>
        </div>
      </div>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Tick all"
                  checked={visible.length > 0 && visible.every((l) => ticked.has(l.id))}
                  onChange={(e) => setTicked(e.target.checked ? new Set(visible.map((l) => l.id)) : new Set())}
                  className="size-4 accent-brand"
                />
              </th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Entry</th>
              <th className="px-4 py-2.5 text-right">In</th>
              <th className="px-4 py-2.5 text-right">Out</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((l) => (
              <tr key={l.id} className={`cursor-pointer ${ticked.has(l.id) ? "bg-green-50/60" : "hover:bg-surface-2/60"}`} onClick={() => toggle(l.id)}>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={ticked.has(l.id)} onChange={() => toggle(l.id)} onClick={(e) => e.stopPropagation()} aria-label={`On statement: ${l.memo}`} className="size-4 accent-brand" />
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{day.format(new Date(`${l.date}T00:00:00Z`))}</td>
                <td className="px-4 py-2">
                  <span className="font-mono text-xs text-muted">{l.number}</span> <span className="text-navy">{l.memo}</span>
                </td>
                <td className="tabular px-4 py-2 text-right text-success">{l.debit ? formatMoney(l.debit) : ""}</td>
                <td className="tabular px-4 py-2 text-right">{l.credit ? formatMoney(l.credit) : ""}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted">
                  Every movement up to this date is already reconciled.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <FormMessage error={state.error} />
      </div>
      <StickyActions summary={<span>{visible.filter((l) => ticked.has(l.id)).length} line(s) ticked · bank charges or interest missing? Record them with a voucher first.</span>}>
        <button type="submit" disabled={pending || diff !== 0} className={`${primaryButton} gap-2`}>
          {pending ? "Saving…" : "Save reconciliation"}
          <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
      </StickyActions>
    </form>
  );
}

export function UndoReconciliation({ companySlug, reconciliationId }: { companySlug: string; reconciliationId: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  return (
    <button
      type="button"
      disabled={pending}
      className={secondaryButtonSm}
      onClick={async () => {
        if (!(await confirm({ title: "Undo this reconciliation?", message: "Its lines become unmatched again.", confirmLabel: "Undo", tone: "danger" }))) return;
        startTransition(async () => {
          const res = await undoReconciliation(companySlug, reconciliationId);
          if (res.error) toast.error(res.error);
          else toast.success("Reconciliation undone.");
        });
      }}
    >
      <Undo2 className="size-3.5" aria-hidden /> Undo
    </button>
  );
}
