"use client";

import { useActionState, useState } from "react";
import { recordSupplierPayment, type PaymentFormState } from "@/lib/actions/accounting";
import type { MoneyAccountOption } from "@/lib/data/ledger";
import { MethodAccountFields } from "@/components/method-account-fields";
import { formatMoney, round2 } from "@/lib/money";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Pay all or part of a supplier bill. The amount starts at the full balance. */
export function RecordPaymentForm({
  companySlug,
  purchaseId,
  supplierName,
  invoiceNumber,
  total,
  balance,
  returnTo,
  accounts,
}: {
  companySlug: string;
  purchaseId: string;
  supplierName: string;
  invoiceNumber: string;
  total: number;
  balance: number;
  returnTo: "accounting" | "purchase";
  accounts: MoneyAccountOption[];
}) {
  const [amount, setAmount] = useState(String(balance));
  const amountInput = useFocusOnShow<HTMLInputElement>();
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(
    recordSupplierPayment.bind(null, companySlug, purchaseId),
    {},
  );
  const value = Number(amount) || 0;
  const tooMuch = value > balance + 0.001;

  return (
    <form action={formAction} data-save-shortcut className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="rounded-lg bg-background p-3 text-sm">
        <p className="font-semibold text-navy">{supplierName}</p>
        <p className="text-muted">
          Invoice {invoiceNumber} · total {formatMoney(total)} · already paid {formatMoney(round2(total - balance))}
        </p>
        <p className="mt-1 font-medium text-navy">Left to pay: {formatMoney(balance)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Amount paid *
          <input
            ref={amountInput}
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
          {tooMuch ? (
            <span className="mt-1 block text-xs font-normal text-danger">More than the {formatMoney(balance)} left to pay.</span>
          ) : value > 0 && value < balance ? (
            <span className="mt-1 block text-xs font-normal text-muted">Partial payment: {formatMoney(round2(balance - value))} will remain.</span>
          ) : null}
        </label>
        <label className={labelClass}>
          Payment date *
          <input name="paidAt" type="date" required defaultValue={today()} className={inputClass} />
        </label>
        <MethodAccountFields accounts={accounts} />
        <label className={labelClass}>
          Reference
          <input name="reference" placeholder="Transfer / cheque no." className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        Note
        <textarea name="notes" rows={2} className={inputClass} />
      </label>

      <FormMessage error={state.error} />
      <button type="submit" disabled={pending || tooMuch || value <= 0} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Record payment"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
