"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createJournalEntry, type FinanceFormState } from "@/lib/actions/finance";
import { today } from "@/lib/dates";
import { formatMoney, round2 } from "@/lib/money";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButtonSm } from "@/components/ui";

type Line = { key: string; accountId: string; debit: string; credit: string; description: string };
const blank = (): Line => ({ key: crypto.randomUUID(), accountId: "", debit: "", credit: "", description: "" });

/** Manual journal entry (opening balances, accruals, corrections): debits must equal credits. */
export function JournalForm({ companySlug, accounts }: { companySlug: string; accounts: { id: string; code: string; name: string }[] }) {
  const [lines, setLines] = useState<Line[]>(() => [blank(), blank()]);
  const [state, formAction, pending] = useActionState<FinanceFormState, FormData>(createJournalEntry.bind(null, companySlug), {});
  const memoInput = useFocusOnShow<HTMLInputElement>();
  const debit = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const credit = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  const diff = round2(debit - credit);
  const set = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form
      action={(fd) => {
        fd.set(
          "payload",
          JSON.stringify({
            date: fd.get("date"),
            memo: fd.get("memo"),
            lines: lines
              .filter((l) => l.accountId || Number(l.debit) || Number(l.credit))
              .map((l) => ({ accountId: l.accountId, debit: round2(Number(l.debit) || 0), credit: round2(Number(l.credit) || 0), description: l.description })),
          }),
        );
        return formAction(fd);
      }}
      data-save-shortcut
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <label className={labelClass}>
          Description *
          <input ref={memoInput} name="memo" required minLength={3} maxLength={300} placeholder="e.g. Opening balances, salary accrual" className={inputClass} />
        </label>
        <label className={labelClass}>
          Date *
          <input name="date" type="date" required defaultValue={today()} className={inputClass} />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="py-2 pr-2">Account</th>
              <th className="py-2 pr-2">Line note</th>
              <th className="w-32 py-2 pr-2 text-right">Debit</th>
              <th className="w-32 py-2 pr-2 text-right">Credit</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.key}>
                <td className="py-1 pr-2">
                  <select value={l.accountId} onChange={(e) => set(l.key, { accountId: e.target.value })} aria-label={`Line ${i + 1} account`} className={inputClass}>
                    <option value="">Choose…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input value={l.description} onChange={(e) => set(l.key, { description: e.target.value })} maxLength={300} aria-label={`Line ${i + 1} note`} className={inputClass} />
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.debit}
                    onChange={(e) => set(l.key, { debit: e.target.value, credit: e.target.value ? "" : l.credit })}
                    aria-label={`Line ${i + 1} debit`}
                    className={`${inputClass} text-right`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.credit}
                    onChange={(e) => set(l.key, { credit: e.target.value, debit: e.target.value ? "" : l.debit })}
                    aria-label={`Line ${i + 1} credit`}
                    className={`${inputClass} text-right`}
                  />
                </td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    title="Remove line"
                    aria-label="Remove line"
                    disabled={lines.length <= 2}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-danger disabled:opacity-30"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-sm">
              <td className="pt-3" colSpan={2}>
                <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} className={secondaryButtonSm}>
                  <Plus className="size-3.5" aria-hidden /> Add line
                </button>
              </td>
              <td className="tabular pr-2 pt-3 text-right font-semibold text-navy">{formatMoney(debit)}</td>
              <td className="tabular pr-2 pt-3 text-right font-semibold text-navy">{formatMoney(credit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={`text-sm ${diff === 0 && debit > 0 ? "text-success" : "text-muted"}`}>
        {debit === 0 ? "Enter the amounts." : diff === 0 ? "Balanced." : `Difference: ${formatMoney(Math.abs(diff))} more ${diff > 0 ? "debit" : "credit"}.`}
      </p>

      <FormMessage error={state.error} />
      <button type="submit" disabled={pending || diff !== 0 || debit === 0} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Post journal entry"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
