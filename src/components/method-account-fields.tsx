"use client";

import { useState } from "react";
import { PAYMENT_METHODS } from "@/lib/accounting";
import type { MoneyAccountOption } from "@/lib/data/ledger";
import { inputClass, labelClass } from "@/components/ui";

/**
 * Payment method + the cash box / bank account the money moved through. Picking "Cash"
 * switches to the first cash account, any other method to the first bank account,
 * until the user picks an account themselves.
 */
export function MethodAccountFields({
  accounts,
  accountLabel = "Paid from *",
  defaultMethod = "BANK_TRANSFER",
}: {
  accounts: MoneyAccountOption[];
  accountLabel?: string;
  defaultMethod?: string;
}) {
  const pick = (method: string) =>
    (accounts.find((a) => a.kind === (method === "CASH" ? "CASH" : "BANK")) ?? accounts[0])?.id ?? "";
  const [method, setMethod] = useState(defaultMethod);
  const [accountId, setAccountId] = useState(() => pick(defaultMethod));
  const [touched, setTouched] = useState(false);

  return (
    <>
      <label className={labelClass}>
        Method *
        <select
          name="method"
          required
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            if (!touched) setAccountId(pick(e.target.value));
          }}
          className={inputClass}
        >
          {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        {accountLabel}
        <select
          name="moneyAccountId"
          required
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            setTouched(true);
          }}
          className={inputClass}
        >
          {accounts.length === 0 && <option value="">No cash or bank account — add one in Chart of accounts</option>}
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
