"use client";

import { useActionState, useState } from "react";
import { recordReceipt, type FinanceFormState } from "@/lib/actions/finance";
import type { MoneyAccountOption } from "@/lib/data/ledger";
import { formatMoney, round2 } from "@/lib/money";
import { MethodAccountFields } from "@/components/method-account-fields";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";
import { today } from "@/lib/dates";

export type OpenInvoiceOption = { id: string; number: string; customerName: string; totalTTC: number; balance: number };

/**
 * Money received from a customer. Against an open invoice (partial payments allowed, the
 * amount starts at the balance) or "on account" for a customer, e.g. an advance.
 */
export function ReceiptForm({
  companySlug,
  accounts,
  invoices,
  customers = [],
  defaultInvoiceId,
}: {
  companySlug: string;
  accounts: MoneyAccountOption[];
  invoices: OpenInvoiceOption[];
  customers?: { id: string; name: string }[];
  defaultInvoiceId?: string;
}) {
  const [mode, setMode] = useState<"invoice" | "account">(invoices.length ? "invoice" : "account");
  const [invoiceId, setInvoiceId] = useState(invoices.find((i) => i.id === defaultInvoiceId)?.id ?? invoices[0]?.id ?? "");
  const invoice = invoices.find((i) => i.id === invoiceId);
  const [amount, setAmount] = useState(invoice ? String(invoice.balance) : "");
  const amountInput = useFocusOnShow<HTMLInputElement>();
  const [state, formAction, pending] = useActionState<FinanceFormState, FormData>(recordReceipt.bind(null, companySlug), {});
  const value = Number(amount) || 0;
  const tooMuch = mode === "invoice" && !!invoice && value > invoice.balance + 0.001;

  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-sm" role="tablist">
        {(["invoice", "account"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === m ? "bg-surface text-navy shadow-sm" : "text-muted hover:text-navy"}`}
          >
            {m === "invoice" ? "Against an invoice" : "On account / advance"}
          </button>
        ))}
      </div>

      {mode === "invoice" ? (
        <>
          <label className={labelClass}>
            Invoice *
            <select
              name="invoiceId"
              required
              value={invoiceId}
              onChange={(e) => {
                setInvoiceId(e.target.value);
                const next = invoices.find((i) => i.id === e.target.value);
                if (next) setAmount(String(next.balance));
              }}
              className={inputClass}
            >
              {invoices.length === 0 && <option value="">No unpaid invoices</option>}
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.number} · {i.customerName} · {formatMoney(i.balance)} due
                </option>
              ))}
            </select>
          </label>
          {invoice && (
            <div className="rounded-lg bg-background p-3 text-sm">
              <p className="font-semibold text-navy">{invoice.customerName}</p>
              <p className="text-muted">
                Invoice {invoice.number} · total {formatMoney(invoice.totalTTC)} · settled {formatMoney(round2(invoice.totalTTC - invoice.balance))}
              </p>
              <p className="mt-1 font-medium text-navy">Left to collect: {formatMoney(invoice.balance)}</p>
            </div>
          )}
        </>
      ) : (
        <label className={labelClass}>
          Customer *
          <select name="customerId" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose a customer
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Amount received *
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
            <span className="mt-1 block text-xs font-normal text-danger">More than the {formatMoney(invoice!.balance)} left to collect.</span>
          ) : mode === "invoice" && invoice && value > 0 && value < invoice.balance ? (
            <span className="mt-1 block text-xs font-normal text-muted">Partial payment: {formatMoney(round2(invoice.balance - value))} will remain.</span>
          ) : null}
        </label>
        <label className={labelClass}>
          Date received *
          <input name="receivedAt" type="date" required defaultValue={today()} className={inputClass} />
        </label>
        <MethodAccountFields accounts={accounts} accountLabel="Paid into *" defaultMethod="CASH" />
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
        {pending ? "Saving…" : "Save receipt voucher"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
