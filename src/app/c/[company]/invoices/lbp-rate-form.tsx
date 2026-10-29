"use client";

import { useActionState } from "react";
import { saveLbpRate, type CustomInvoiceState } from "@/lib/actions/invoices";
import { formatRate } from "@/lib/pos";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

/** The rate new invoices and credit notes use to print their VAT in LBP (shared with the till). */
export function LbpRateForm({ companySlug, current }: { companySlug: string; current: number | null }) {
  const [state, formAction, pending] = useActionState<CustomInvoiceState, FormData>(saveLbpRate.bind(null, companySlug), {});
  const input = useFocusOnShow<HTMLInputElement>();
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <label className={labelClass}>
        LBP for 1 USD *
        <input ref={input} name="lbpPerUsd" required inputMode="numeric" defaultValue={current ?? ""} placeholder="e.g. 89500" className={`${inputClass} tabular text-lg`} />
      </label>
      <p className="text-sm text-muted">
        {current ? `Current rate: ${formatRate(current)}. ` : ""}New invoices and credit notes print their VAT in LBP at this rate. Invoices already issued keep their rate.
      </p>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Save rate"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
