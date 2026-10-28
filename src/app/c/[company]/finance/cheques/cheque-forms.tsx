"use client";

import { useActionState, useState, useTransition } from "react";
import { Ban, Landmark, Undo2 } from "lucide-react";
import { bounceCheque, clearCheque, depositCheque, issueCheque, receiveCheque, type ChequeFormState } from "@/lib/actions/cheques";
import type { MoneyAccountOption } from "@/lib/data/ledger";
import { today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { useFeedback } from "@/components/feedback";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButtonSm } from "@/components/ui";

function ChequeFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>
        Cheque number *
        <input name="chequeNumber" required maxLength={40} className={`${inputClass} font-mono`} />
      </label>
      <label className={labelClass}>
        Bank
        <input name="bank" maxLength={80} placeholder="e.g. Bank Audi" className={inputClass} />
      </label>
      <label className={labelClass}>
        Given on *
        <input name="issueDate" type="date" required defaultValue={today()} className={inputClass} />
      </label>
      <label className={labelClass}>
        Cheque date (due) *
        <input name="dueDate" type="date" required defaultValue={today()} className={inputClass} />
      </label>
    </div>
  );
}

type OpenInvoice = { id: string; label: string; customerId: string | null; balance: number };
export function ReceivedChequeForm({ companySlug, invoices, customers }: { companySlug: string; invoices: OpenInvoice[]; customers: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ChequeFormState, FormData>(receiveCheque.bind(null, companySlug), {});
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const first = useFocusOnShow<HTMLSelectElement>();
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          For invoice
          <select
            ref={first}
            name="invoiceId"
            value={invoiceId}
            onChange={(e) => {
              setInvoiceId(e.target.value);
              const inv = invoices.find((i) => i.id === e.target.value);
              if (inv) setAmount(String(inv.balance));
            }}
            className={inputClass}
          >
            <option value="">— On account (no invoice) —</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        {!invoiceId ? (
          <label className={labelClass}>
            Customer *
            <select name="customerId" defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choose…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div />
        )}
        <label className={labelClass}>
          Amount *
          <input name="amount" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </label>
      </div>
      <ChequeFields />
      <label className={labelClass}>
        Note
        <input name="notes" maxLength={1000} className={inputClass} />
      </label>
      <p className="text-xs text-muted">The invoice is settled now; the money waits in “Cheques to collect” until the bank pays the cheque.</p>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Record cheque"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

type OpenBill = { id: string; label: string; balance: number };
export function IssuedChequeForm({ companySlug, bills }: { companySlug: string; bills: OpenBill[] }) {
  const [state, formAction, pending] = useActionState<ChequeFormState, FormData>(issueCheque.bind(null, companySlug), {});
  const [amount, setAmount] = useState("");
  const first = useFocusOnShow<HTMLSelectElement>();
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Supplier bill *
          <select
            ref={first}
            name="purchaseId"
            required
            defaultValue=""
            onChange={(e) => {
              const b = bills.find((x) => x.id === e.target.value);
              if (b) setAmount(String(b.balance));
            }}
            className={inputClass}
          >
            <option value="" disabled>
              Choose…
            </option>
            {bills.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Amount *
          <input name="amount" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </label>
      </div>
      <ChequeFields />
      <label className={labelClass}>
        Note
        <input name="notes" maxLength={1000} className={inputClass} />
      </label>
      <p className="text-xs text-muted">The bill is paid now; the money stays in your bank (account 403 “Cheques issued”) until the supplier cashes it.</p>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Record cheque"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

export function ClearChequeForm({ companySlug, chequeId, amount, accounts }: { companySlug: string; chequeId: string; amount: number; accounts: MoneyAccountOption[] }) {
  const [state, formAction, pending] = useActionState<ChequeFormState, FormData>(clearCheque.bind(null, companySlug, chequeId), {});
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <p className="rounded-lg bg-background p-3 text-sm">
        Amount: <span className="tabular font-semibold text-navy">{formatMoney(amount)}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Cleared on *
          <input name="date" type="date" required defaultValue={today()} className={inputClass} />
        </label>
        <label className={labelClass}>
          Bank account *
          <select name="bankAccountId" defaultValue={accounts.find((a) => a.kind === "BANK")?.id ?? accounts[0]?.id} className={inputClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Mark as cleared"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

export function ChequeRowActions({ companySlug, chequeId, label, status, direction }: { companySlug: string; chequeId: string; label: string; status: string; direction: "RECEIVED" | "ISSUED" }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else toast.success(ok);
    });
  return (
    <span className="inline-flex gap-1">
      {direction === "RECEIVED" && status === "IN_HAND" && (
        <button type="button" disabled={pending} className={secondaryButtonSm} onClick={() => run(() => depositCheque(companySlug, chequeId), "Marked as deposited.")}>
          <Landmark className="size-3.5" aria-hidden /> Deposited
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        className={`${secondaryButtonSm} text-danger hover:bg-red-50`}
        onClick={async () => {
          const ok = await confirm({
            title: `Cheque ${label} bounced?`,
            message: direction === "RECEIVED" ? "The customer owes the amount again: the payment is reversed and the invoice reopens." : "The supplier bill is open again: the payment is reversed.",
            confirmLabel: "Bounced",
            tone: "danger",
          });
          if (ok) run(() => bounceCheque(companySlug, chequeId, "BOUNCED"), "Cheque marked as bounced.");
        }}
      >
        <Undo2 className="size-3.5" aria-hidden /> Bounced
      </button>
      {status !== "CLEARED" && (
        <button
          type="button"
          disabled={pending}
          title="Cancel (given back / replaced)"
          aria-label={`Cancel cheque ${label}`}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-danger"
          onClick={async () => {
            const ok = await confirm({ title: `Cancel cheque ${label}?`, message: "For a cheque given back or replaced. Its payment is reversed.", confirmLabel: "Cancel cheque", tone: "danger" });
            if (ok) run(() => bounceCheque(companySlug, chequeId, "CANCELLED"), "Cheque cancelled.");
          }}
        >
          <Ban className="size-4" aria-hidden />
        </button>
      )}
    </span>
  );
}
