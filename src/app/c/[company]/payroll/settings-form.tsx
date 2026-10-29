"use client";

import { useActionState } from "react";
import { savePayrollSettings, type PayrollFormState } from "@/lib/actions/payroll";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

type Rules = {
  sicknessEmployee: number;
  sicknessEmployer: number;
  sicknessCap: number;
  familyEmployer: number;
  familyCap: number;
  endOfService: number;
  bracketsText: string;
  defaultExemption: number;
};

/** NSSF rates and ceilings, and the income-tax brackets, for this company's payroll. */
export function PayrollSettingsForm({ companySlug, rules }: { companySlug: string; rules: Rules }) {
  const [state, formAction, pending] = useActionState<PayrollFormState, FormData>(savePayrollSettings.bind(null, companySlug), {});
  const num = (name: keyof Rules, label: string, hint?: string) => (
    <label className={labelClass}>
      {label}
      <input name={name} type="number" min="0" step="0.001" defaultValue={rules[name] as number} className={`${inputClass} tabular`} />
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
  return (
    <form action={formAction} data-save-shortcut className="space-y-5">
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Have your accountant confirm these figures: NSSF rates, ceilings and income-tax brackets have changed several times since 2019. Ceilings are monthly
        amounts in USD (0 = no ceiling).
      </p>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-navy">NSSF — sickness & maternity</legend>
        {num("sicknessEmployee", "Employee share %")}
        {num("sicknessEmployer", "Employer share %")}
        {num("sicknessCap", "Monthly ceiling (USD)")}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-navy">NSSF — family allowances & end of service (employer)</legend>
        {num("familyEmployer", "Family allowances %")}
        {num("familyCap", "Family ceiling (USD / month)")}
        {num("endOfService", "End of service %", "No ceiling")}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <label className={labelClass}>
          Income-tax brackets (yearly, USD) — one per line: “up to” then the rate
          <textarea name="taxBrackets" rows={7} defaultValue={rules.bracketsText} placeholder={"e.g.\n18000 2\n45000 4\n…\n* 25"} className={`${inputClass} font-mono`} />
          <span className="mt-1 block text-xs font-normal text-muted">The last line “* rate” applies above the highest amount. Leave empty to withhold no income tax.</span>
        </label>
        {num("defaultExemption", "Yearly exemption for new staff (USD)", "Family allowance per person is set on each employee.")}
      </div>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Save payroll settings"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
