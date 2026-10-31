"use client";

import { SaveNewButton } from "@/components/save-new-button";
import { useActionState, useEffect, useState } from "react";
import { recordSupplierPayment, type PaymentFormState } from "@/lib/actions/accounting";
import type { MoneyAccountOption } from "@/lib/data/ledger";
import { today } from "@/lib/dates";
import { formatMoney, round2 } from "@/lib/money";
import { MethodAccountFields } from "@/components/method-account-fields";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

export type OpenBillOption = { id: string; supplierId: string; supplierName: string; invoiceNumber: string; dueDate: string; total: number; balance: number };

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/** A PV paying all or part of one supplier bill. Choose the supplier, then the bill; the amount starts at its balance. */
export function SupplierPaymentForm({
  companySlug,
  bills,
  accounts,
  defaultBillId,
  onSaved,
}: {
  companySlug: string;
  bills: OpenBillOption[];
  accounts: MoneyAccountOption[];
  defaultBillId?: string;
  onSaved?: (id: string, again?: boolean) => void; // in a pop-up: stay on the page and report the new id (again: Save & new)
}) {
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(recordSupplierPayment.bind(null, companySlug), {});
  useEffect(() => {
    if (state.savedId) onSaved?.(state.savedId, state.again);
  }, [state, onSaved]);
  const start = bills.find((b) => b.id === defaultBillId);
  const [supplierId, setSupplierId] = useState(start?.supplierId ?? "");
  const [billId, setBillId] = useState(start?.id ?? "");
  const [amount, setAmount] = useState(start ? String(start.balance) : "");
  const amountInput = useFocusOnShow<HTMLInputElement>();

  const suppliers = [...new Map(bills.map((b) => [b.supplierId, b.supplierName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const supplierBills = bills.filter((b) => b.supplierId === supplierId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const bill = supplierBills.find((b) => b.id === billId);
  const value = Number(amount) || 0;
  const tooMuch = !!bill && value > bill.balance + 0.001;

  function chooseBill(next: OpenBillOption | undefined) {
    setBillId(next?.id ?? "");
    setAmount(next ? String(next.balance) : "");
  }

  if (bills.length === 0) return <p className="text-sm text-muted">No supplier bills are waiting to be paid.</p>;

  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      {onSaved && <input type="hidden" name="stay" value="1" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Supplier *
          <select
            required
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              // Oldest bill first: usually the one being paid.
              chooseBill(bills.filter((b) => b.supplierId === e.target.value).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]);
            }}
            className={inputClass}
          >
            <option value="" disabled>
              Choose a supplier
            </option>
            {suppliers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Bill *
          <select name="purchaseId" required value={billId} disabled={!supplierId} onChange={(e) => chooseBill(supplierBills.find((b) => b.id === e.target.value))} className={inputClass}>
            {!supplierId && <option value="">Choose the supplier first</option>}
            {supplierBills.map((b) => (
              <option key={b.id} value={b.id}>
                {b.invoiceNumber} · due {dateFormat.format(new Date(b.dueDate))} · {formatMoney(b.balance)} left
              </option>
            ))}
          </select>
        </label>
      </div>

      {bill && (
        <div className="rounded-lg bg-background p-3 text-sm">
          <p className="text-muted">
            Invoice {bill.invoiceNumber} · total {formatMoney(bill.total)} · already paid {formatMoney(round2(bill.total - bill.balance))}
          </p>
          <p className="mt-1 font-medium text-navy">Left to pay: {formatMoney(bill.balance)}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Amount paid *
          <input ref={amountInput} name="amount" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          {tooMuch ? (
            <span className="mt-1 block text-xs font-normal text-danger">More than the {formatMoney(bill.balance)} left to pay.</span>
          ) : bill && value > 0 && value < bill.balance ? (
            <span className="mt-1 block text-xs font-normal text-muted">Partial payment: {formatMoney(round2(bill.balance - value))} will remain.</span>
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
      <div className="flex gap-2">
        <button type="submit" disabled={pending || !bill || tooMuch || value <= 0} className={`${primaryButton} flex-1 gap-2`}>
          {pending ? "Saving…" : "Save payment voucher"}
          <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
        <SaveNewButton disabled={pending || !bill || tooMuch || value <= 0} />
      </div>
    </form>
  );
}
