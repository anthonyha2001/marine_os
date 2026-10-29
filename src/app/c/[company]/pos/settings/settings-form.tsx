"use client";

import { useActionState } from "react";
import { savePosSettings, type PosFormState } from "@/lib/actions/pos";
import type { PosRules } from "@/lib/pos";
import { FormMessage, Kbd, cardClass, inputClass, labelClass, primaryButton } from "@/components/ui";

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3 py-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-brand" />
      <span className="text-sm">
        <span className="font-medium text-navy">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={`${cardClass} p-5`}>
      <h2 className="font-semibold text-navy">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-3 divide-y divide-border">{children}</div>
    </section>
  );
}

/** What the till allows. Cashier limits don't apply to managers, accountants and admins. */
export function PosSettingsForm({ companySlug, rules }: { companySlug: string; rules: PosRules }) {
  const [state, formAction, pending] = useActionState<PosFormState, FormData>(savePosSettings.bind(null, companySlug), {});
  return (
    <form action={formAction} data-save-shortcut className="grid gap-5 lg:grid-cols-2">
      <Section title="Discounts" hint="Managers and admins can always give any discount.">
        <label className={`${labelClass} py-2`}>
          Largest discount a cashier can give (%)
          <input name="maxDiscountPct" type="number" min="0" max="100" step="0.5" defaultValue={rules.maxDiscountPct} className={`${inputClass} w-32 tabular`} />
          <span className="mt-1 block text-xs font-normal text-muted">0 = cashiers can&apos;t give discounts.</span>
        </label>
      </Section>

      <Section title="Payments" hint="Ways the customer can pay at the till.">
        <Toggle name="allowUsd" label="Cash in USD" defaultChecked={rules.allowUsd} />
        <Toggle name="allowLbp" label="Cash in LBP" defaultChecked={rules.allowLbp} />
        <Toggle name="allowCard" label="Card" defaultChecked={rules.allowCard} />
        <fieldset className="py-2">
          <legend className="text-sm font-medium text-navy">If the card amount is more than the total</legend>
          <label className="mt-2 flex items-start gap-3 text-sm">
            <input type="radio" name="cardOverpay" value="BLOCK" defaultChecked={rules.cardOverpay === "BLOCK"} className="mt-0.5 size-4 accent-brand" />
            <span>
              Stop the sale
              <span className="block text-xs text-muted">The cashier must correct the card amount. Safest.</span>
            </span>
          </label>
          <label className="mt-2 flex items-start gap-3 text-sm">
            <input type="radio" name="cardOverpay" value="CHANGE" defaultChecked={rules.cardOverpay === "CHANGE"} className="mt-0.5 size-4 accent-brand" />
            <span>
              Allow it and give the difference back in cash
              <span className="block text-xs text-muted">The extra charged on the card comes out of the drawer as change.</span>
            </span>
          </label>
        </fieldset>
      </Section>

      <Section title="Selling">
        <Toggle
          name="sellOutOfStock"
          label="Cashiers can sell more than the stock shows"
          hint="Off: the till stops the sale when a quantity is more than what's in stock."
          defaultChecked={rules.sellOutOfStock}
        />
        <label className={`${labelClass} py-2`}>
          Customer name required above (USD incl. VAT)
          <input name="customerRequiredAbove" type="number" min="0" step="1" defaultValue={rules.customerRequiredAbove} className={`${inputClass} w-32 tabular`} />
          <span className="mt-1 block text-xs font-normal text-muted">0 = never required. Applies to everyone.</span>
        </label>
      </Section>

      <Section title="Refunds">
        <Toggle name="cashierRefunds" label="Cashiers can give refunds" hint="Off: only a manager or admin can refund." defaultChecked={rules.cashierRefunds} />
        <label className={`${labelClass} py-2`}>
          Cashiers can refund sales up to (days old)
          <input name="refundDays" type="number" min="0" step="1" defaultValue={rules.refundDays} className={`${inputClass} w-32 tabular`} />
          <span className="mt-1 block text-xs font-normal text-muted">0 = no limit.</span>
        </label>
      </Section>

      <Section title="Cash drawer">
        <Toggle
          name="blindClose"
          label="Blind count when closing a shift"
          hint="The cashier counts the drawer without seeing how much it should hold. The difference shows after closing."
          defaultChecked={rules.blindClose}
        />
        <Toggle name="cashierSeesShiftTotals" label="Cashiers see their shift's sales total" defaultChecked={rules.cashierSeesShiftTotals} />
      </Section>

      <Section title="Receipt">
        <label className={`${labelClass} py-2`}>
          Note at the bottom of the receipt
          <textarea name="receiptNote" rows={3} maxLength={300} defaultValue={rules.receiptNote ?? ""} placeholder="Goods can be returned with this receipt." className={inputClass} />
          <span className="mt-1 block text-xs font-normal text-muted">E.g. your return policy, opening hours or Instagram.</span>
        </label>
      </Section>

      <div className="lg:col-span-2">
        <FormMessage error={state.error} />
        <button type="submit" disabled={pending} className={`${primaryButton} mt-2 gap-2`}>
          {pending ? "Saving…" : "Save POS settings"}
          <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
      </div>
    </form>
  );
}
