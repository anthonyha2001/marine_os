"use client";

import { useActionState } from "react";
import { saveEmployee, type PayrollFormState } from "@/lib/actions/payroll";
import type { EmployeeRow } from "@/lib/data/payroll";
import { PAY_FREQUENCIES } from "@/lib/payroll";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

export function EmployeeForm({ companySlug, employee }: { companySlug: string; employee?: EmployeeRow }) {
  const [state, formAction, pending] = useActionState<PayrollFormState, FormData>(saveEmployee.bind(null, companySlug, employee?.id ?? null), {});
  const nameInput = useFocusOnShow<HTMLInputElement>();
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Full name *
          <input ref={nameInput} name="name" required minLength={2} maxLength={120} defaultValue={employee?.name} className={inputClass} />
        </label>
        <label className={labelClass}>
          Job title
          <input name="position" maxLength={120} defaultValue={employee?.position ?? ""} placeholder="e.g. Mechanic, Cashier" className={inputClass} />
        </label>
        <label className={labelClass}>
          Paid *
          <select name="payFrequency" defaultValue={employee?.payFrequency ?? "MONTHLY"} className={inputClass}>
            {Object.entries(PAY_FREQUENCIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Base salary (USD) *
          <input name="baseSalary" type="number" min="0" step="0.01" required defaultValue={employee?.baseSalary} placeholder="per month or per week" className={inputClass} />
        </label>
        <label className={labelClass}>
          Phone
          <input name="phone" maxLength={60} defaultValue={employee?.phone ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          ID / NSSF number
          <input name="idNumber" maxLength={60} defaultValue={employee?.idNumber ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Start date
          <input name="startDate" type="date" defaultValue={employee?.startDate ? employee.startDate.toISOString().slice(0, 10) : ""} className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        Notes
        <textarea name="notes" rows={2} maxLength={1000} defaultValue={employee?.notes ?? ""} className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : employee ? "Save employee" : "Add employee"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
