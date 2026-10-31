"use client";

import { useActionState, useEffect, useState } from "react";
import { createVoucher, type FinanceFormState } from "@/lib/actions/finance";
import type { MoneyAccountOption } from "@/lib/data/ledger";
import { today } from "@/lib/dates";
import { VAT_RATE, formatMoney, round2 } from "@/lib/money";
import { MethodAccountFields } from "@/components/method-account-fields";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

export type VoucherKind = "PAYMENT" | "RECEIPT" | "TRANSFER";
export type CounterAccountOption = { id: string; code: string; name: string; type: string };

const TYPE_LABELS: Record<string, string> = { EXPENSE: "Expenses", INCOME: "Income", EQUITY: "Equity & capital", LIABILITY: "Liabilities", ASSET: "Assets" };
const ORDER: Record<VoucherKind, string[]> = {
  PAYMENT: ["EXPENSE", "LIABILITY", "ASSET", "EQUITY"],
  RECEIPT: ["INCOME", "EQUITY", "LIABILITY", "ASSET"],
  TRANSFER: [],
};

/**
 * PV: pay any expense (rent, salaries, fuel…) from a cash box or bank account.
 * RV: money coming in that isn't a customer invoice (capital, loan, other income).
 * Transfer: move money between cash and bank (e.g. cash deposited at the bank).
 */
export function VoucherForm({
  companySlug,
  kind,
  moneyAccounts,
  counterAccounts,
  onSaved,
}: {
  companySlug: string;
  kind: VoucherKind;
  moneyAccounts: MoneyAccountOption[];
  counterAccounts: CounterAccountOption[];
  onSaved?: (id: string) => void; // in a pop-up: stay on the page and report the new id
}) {
  const [state, formAction, pending] = useActionState<FinanceFormState, FormData>(createVoucher.bind(null, companySlug), {});
  useEffect(() => {
    if (state.savedId) onSaved?.(state.savedId);
  }, [state, onSaved]);
  const [amount, setAmount] = useState("");
  const [withVat, setWithVat] = useState(false);
  const first = useFocusOnShow<HTMLInputElement>();
  const value = Number(amount) || 0;
  const vat = withVat ? round2(value - value / (1 + VAT_RATE)) : 0;

  const groups = ORDER[kind].map((type) => ({ type, items: counterAccounts.filter((a) => a.type === type) })).filter((g) => g.items.length);

  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      {onSaved && <input type="hidden" name="stay" value="1" />}
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-4 sm:grid-cols-2">
        {kind !== "TRANSFER" ? (
          <label className={labelClass}>
            {kind === "PAYMENT" ? "Paid to" : "Received from"}
            <input ref={first} name="partyName" maxLength={200} placeholder={kind === "PAYMENT" ? "e.g. EDL, landlord, staff name" : "e.g. partner name, bank"} className={inputClass} />
          </label>
        ) : (
          <div />
        )}
        <label className={labelClass}>
          Date *
          <input name="date" type="date" required defaultValue={today()} className={inputClass} />
        </label>
      </div>

      <label className={labelClass}>
        Description *
        <input
          ref={kind === "TRANSFER" ? first : undefined}
          name="description"
          required
          minLength={2}
          maxLength={500}
          placeholder={kind === "PAYMENT" ? "e.g. Office rent, October" : kind === "RECEIPT" ? "e.g. Capital contribution" : "e.g. Cash deposited at the bank"}
          className={inputClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <MethodAccountFields
          accounts={moneyAccounts}
          accountLabel={kind === "PAYMENT" ? "Paid from *" : kind === "RECEIPT" ? "Received into *" : "From *"}
          defaultMethod="CASH"
        />
        <label className={labelClass}>
          {kind === "PAYMENT" ? "Expense / account *" : kind === "RECEIPT" ? "Income / account *" : "To *"}
          <select name="counterAccountId" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {kind === "TRANSFER"
              ? moneyAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))
              : groups.map((g) => (
                  <optgroup key={g.type} label={TYPE_LABELS[g.type]}>
                    {g.items.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
          </select>
        </label>
        <label className={labelClass}>
          Amount *
          <input name="amount" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Reference
          <input name="reference" maxLength={200} placeholder="Bill / cheque / transfer no." className={inputClass} />
        </label>
      </div>

      {kind === "PAYMENT" && (
        <label className="flex items-start gap-2 rounded-lg bg-background p-3 text-sm">
          <input type="checkbox" name="withVat" checked={withVat} onChange={(e) => setWithVat(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
          <span>
            <span className="font-medium text-navy">The amount includes {VAT_RATE * 100}% recoverable VAT</span>
            <span className="block text-xs text-muted">
              {withVat && value > 0
                ? `${formatMoney(round2(value - vat))} expense + ${formatMoney(vat)} VAT recoverable`
                : "Tick when you have a VAT invoice for this expense."}
            </span>
          </span>
        </label>
      )}

      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : kind === "PAYMENT" ? "Save payment voucher" : kind === "RECEIPT" ? "Save receipt voucher" : "Save transfer"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
