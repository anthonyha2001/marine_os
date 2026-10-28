"use client";

import { useActionState, useState } from "react";
import { saveLedgerAccount, type FinanceFormState } from "@/lib/actions/finance";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

type Kind = "CASH" | "BANK" | "EXPENSE" | "INCOME" | "OTHER";
type Type = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

const KINDS: { value: Kind; label: string; type?: Type }[] = [
  { value: "EXPENSE", label: "Expense", type: "EXPENSE" },
  { value: "INCOME", label: "Income", type: "INCOME" },
  { value: "CASH", label: "Cash box", type: "ASSET" },
  { value: "BANK", label: "Bank account", type: "ASSET" },
  { value: "OTHER", label: "Other (asset, liability, equity)" },
];

/** Add or rename an account. System accounts (used by automatic postings) can only be renamed. */
export function AccountForm({
  companySlug,
  account,
}: {
  companySlug: string;
  account?: { id: string; code: string; name: string; type: Type; kind: string; isSystem: boolean };
}) {
  const initialKind: Kind = account && ["CASH", "BANK", "EXPENSE", "INCOME"].includes(account.kind) ? (account.kind as Kind) : account ? "OTHER" : "EXPENSE";
  const [kind, setKind] = useState<Kind>(initialKind);
  const [type, setType] = useState<Type>(account?.type ?? "EXPENSE");
  const [state, formAction, pending] = useActionState<FinanceFormState, FormData>(saveLedgerAccount.bind(null, companySlug, account?.id ?? null), {});
  const nameInput = useFocusOnShow<HTMLInputElement>();
  const locked = !!account?.isSystem;
  const fixedType = KINDS.find((k) => k.value === kind)?.type;

  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      {locked && (
        <p className="rounded-lg bg-background p-3 text-sm text-muted">This account is used by automatic postings. Only its name can be changed.</p>
      )}
      {locked && (
        <>
          <input type="hidden" name="code" value={account?.code} />
          <input type="hidden" name="type" value={account?.type} />
          <input type="hidden" name="kind" value="OTHER" />
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <label className={labelClass}>
          Code *
          <input name={locked ? undefined : "code"} required pattern="\d{2,8}" defaultValue={account?.code} disabled={locked} placeholder="e.g. 6063" className={`${inputClass} font-mono`} />
        </label>
        <label className={labelClass}>
          Name *
          <input ref={nameInput} name="name" required minLength={2} maxLength={120} defaultValue={account?.name} placeholder="e.g. Boat fuel" className={inputClass} />
        </label>
      </div>
      {!locked && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Kind *
            <select
              name="kind"
              value={kind}
              onChange={(e) => {
                const k = e.target.value as Kind;
                setKind(k);
                const t = KINDS.find((x) => x.value === k)?.type;
                if (t) setType(t);
                else if (type === "EXPENSE" || type === "INCOME") setType("LIABILITY");
              }}
              className={inputClass}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Type *
            {fixedType ? (
              <>
                <input type="hidden" name="type" value={fixedType} />
                <input disabled value={{ ASSET: "Asset", LIABILITY: "Liability", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expense" }[fixedType]} className={inputClass} />
              </>
            ) : (
              <select name="type" value={type} onChange={(e) => setType(e.target.value as Type)} className={inputClass}>
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
              </select>
            )}
          </label>
        </div>
      )}
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : account ? "Save account" : "Add account"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
