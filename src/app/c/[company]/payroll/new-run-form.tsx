"use client";

import { useActionState, useState } from "react";
import { createPayrollRun, type PayrollFormState } from "@/lib/actions/payroll";
import { today } from "@/lib/dates";
import { PAY_FREQUENCIES, payPeriod, type PayFrequency } from "@/lib/payroll";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

export function NewRunForm({ companySlug, counts }: { companySlug: string; counts: Record<PayFrequency, number> }) {
  const [state, formAction, pending] = useActionState<PayrollFormState, FormData>(createPayrollRun.bind(null, companySlug), {});
  const [frequency, setFrequency] = useState<PayFrequency>(counts.MONTHLY || !counts.WEEKLY ? "MONTHLY" : "WEEKLY");
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [week, setWeek] = useState(() => today());
  const period = payPeriod(frequency, frequency === "MONTHLY" ? month : week);

  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Pay frequency *
          <select name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as PayFrequency)} className={inputClass}>
            {Object.entries(PAY_FREQUENCIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l} ({counts[v as PayFrequency]} staff)
              </option>
            ))}
          </select>
        </label>
        {frequency === "MONTHLY" ? (
          <label className={labelClass}>
            Month *
            <input name="period" type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
          </label>
        ) : (
          <label className={labelClass}>
            Any day in the week *
            <input name="period" type="date" required value={week} onChange={(e) => setWeek(e.target.value)} className={inputClass} />
          </label>
        )}
      </div>
      {period && (
        <p className="rounded-lg bg-background p-3 text-sm">
          <span className="font-medium text-navy">{period.label}</span>{" "}
          <span className="text-muted">
            ({period.start.toISOString().slice(0, 10)} → {period.end.toISOString().slice(0, 10)}) · {counts[frequency]} employee{counts[frequency] === 1 ? "" : "s"} at their base salary
          </span>
        </p>
      )}
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Creating…" : "Start payroll"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
