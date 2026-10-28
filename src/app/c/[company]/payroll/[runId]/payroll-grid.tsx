"use client";

import { useActionState, useState } from "react";
import { savePayrollLines, type PayrollFormState } from "@/lib/actions/payroll";
import { formatMoney, round2 } from "@/lib/money";
import { lineGross, lineNet } from "@/lib/payroll";
import { FormMessage, Kbd, StickyActions, cardClass, inputClass, primaryButton } from "@/components/ui";

type Line = { id: string; name: string; position: string | null; baseSalary: number; bonus: number; overtime: number; deductions: number; advance: number; note: string | null; owedAdvance: number };
type Field = "baseSalary" | "bonus" | "overtime" | "deductions" | "advance";
const FIELDS: { key: Field; label: string }[] = [
  { key: "baseSalary", label: "Base" },
  { key: "bonus", label: "Bonus" },
  { key: "overtime", label: "Overtime" },
  { key: "deductions", label: "Deductions" },
  { key: "advance", label: "Advance back" },
];

/** Draft payroll: one row per employee; net updates as you type. Ctrl+S saves. */
export function PayrollGrid({ companySlug, runId, lines, notes }: { companySlug: string; runId: string; lines: Line[]; notes: string | null }) {
  const [values, setValues] = useState(() => Object.fromEntries(lines.map((l) => [l.id, Object.fromEntries(FIELDS.map((f) => [f.key, l[f.key] ? String(l[f.key]) : ""]))])) as Record<string, Record<Field, string>>);
  const [lineNotes, setLineNotes] = useState(() => Object.fromEntries(lines.map((l) => [l.id, l.note ?? ""])) as Record<string, string>);
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState<PayrollFormState, FormData>(savePayrollLines.bind(null, companySlug, runId), {});
  const amounts = (id: string) => {
    const v = values[id];
    const n = (k: Field) => Number(v[k]) || 0;
    return { baseSalary: n("baseSalary"), bonus: n("bonus"), overtime: n("overtime"), deductions: n("deductions"), advance: n("advance") };
  };
  const totalNet = round2(lines.reduce((s, l) => s + lineNet(amounts(l.id)), 0));
  const totalGross = round2(lines.reduce((s, l) => s + lineGross(amounts(l.id)), 0));
  const negative = lines.some((l) => lineNet(amounts(l.id)) < 0);

  return (
    <form
      action={(fd) => {
        fd.set("payload", JSON.stringify({ notes: fd.get("notes"), lines: lines.map((l) => ({ id: l.id, ...amounts(l.id), note: lineNotes[l.id] })) }));
        return formAction(fd);
      }}
      data-save-shortcut
      data-dirty={dirty ? "true" : undefined}
    >
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full min-w-[64rem] text-sm">
          <thead className="bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2.5">Employee</th>
              {FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-2.5 text-right">
                  {f.label}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right">Net pay</th>
              <th className="px-2 py-2.5">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((l) => {
              const net = lineNet(amounts(l.id));
              return (
                <tr key={l.id}>
                  <td className="px-4 py-2">
                    <span className="font-medium text-navy">{l.name}</span>
                    {l.position && <span className="block text-xs text-muted">{l.position}</span>}
                    {l.owedAdvance > 0 && <span className="block text-xs text-amber-700">Owes {formatMoney(l.owedAdvance)} in advances</span>}
                  </td>
                  {FIELDS.map((f) => (
                    <td key={f.key} className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={values[l.id][f.key]}
                        placeholder="0"
                        onChange={(e) => {
                          setDirty(true);
                          setValues((v) => ({ ...v, [l.id]: { ...v[l.id], [f.key]: e.target.value } }));
                        }}
                        aria-label={`${f.label} for ${l.name}`}
                        className={`${inputClass} h-9 w-24 text-right tabular`}
                      />
                    </td>
                  ))}
                  <td className={`tabular px-4 py-2 text-right font-semibold ${net < 0 ? "text-danger" : "text-navy"}`}>{formatMoney(net)}</td>
                  <td className="px-2 py-2">
                    <input
                      value={lineNotes[l.id]}
                      maxLength={300}
                      onChange={(e) => {
                        setDirty(true);
                        setLineNotes((n) => ({ ...n, [l.id]: e.target.value }));
                      }}
                      aria-label={`Note for ${l.name}`}
                      className={`${inputClass} h-9 w-40`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="mt-4 block text-[13px] font-medium text-slate-700">
        Notes on this payroll
        <textarea name="notes" rows={2} maxLength={1000} defaultValue={notes ?? ""} onChange={() => setDirty(true)} className={inputClass} />
      </label>
      <div className="mt-4">
        <FormMessage error={state.error ?? (negative ? "Someone's net pay is negative. Lower the deductions or the advance." : undefined)} />
      </div>
      <StickyActions
        summary={
          <span>
            Salary cost {formatMoney(totalGross)} · <span className="font-semibold text-navy">net to pay {formatMoney(totalNet)}</span>
          </span>
        }
      >
        <button type="submit" disabled={pending || negative} className={`${primaryButton} gap-2`}>
          {pending ? "Saving…" : "Save"}
          <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
      </StickyActions>
    </form>
  );
}
