"use client";

import { useActionState, useTransition } from "react";
import { CheckCircle2, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { addMissingStaff, deletePayrollRun, payPayroll, setPayrollStatus, undoPayrollPayment, type PayrollFormState } from "@/lib/actions/payroll";
import type { MoneyAccountOption } from "@/lib/data/ledger";
import { today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { useFeedback } from "@/components/feedback";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButton } from "@/components/ui";

/** Approve / reopen / undo payment / delete / add staff hired since, with in-app confirmations. */
export function RunActions({ companySlug, runId, status, label }: { companySlug: string; runId: string; status: "DRAFT" | "APPROVED" | "PAID"; label: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  const run = (fn: () => Promise<{ error?: string } | void>, ok: string) =>
    startTransition(async () => {
      try {
        const res = await fn();
        if (res && "error" in res && res.error) toast.error(res.error);
        else toast.success(ok);
      } catch (e) {
        if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
        toast.error("Something went wrong. Check your connection and try again.");
      }
    });

  return (
    <>
      {status === "DRAFT" && (
        <>
          <button
            type="button"
            disabled={pending}
            className={secondaryButton}
            onClick={() =>
              startTransition(async () => {
                const res = await addMissingStaff(companySlug, runId);
                if (res.error) toast.error(res.error);
                else toast.info(res.added ? `${res.added} employee${res.added === 1 ? "" : "s"} added.` : "Everyone is already on this payroll.");
              })
            }
          >
            <UserPlus className="size-4" aria-hidden /> Add new staff
          </button>
          <button
            type="button"
            disabled={pending}
            className={primaryButton}
            onClick={async () => {
              const yes = await confirm({ title: `Approve the ${label} payroll?`, message: "Amounts are locked. You can then print the sheet for staff to sign and pay it. Save your changes first.", confirmLabel: "Approve" });
              if (yes) run(() => setPayrollStatus(companySlug, runId, "APPROVED"), "Payroll approved.");
            }}
          >
            <CheckCircle2 className="size-4" aria-hidden /> Approve
          </button>
        </>
      )}
      {status === "APPROVED" && (
        <button type="button" disabled={pending} className={secondaryButton} onClick={() => run(() => setPayrollStatus(companySlug, runId, "DRAFT"), "Payroll reopened for changes.")}>
          <RotateCcw className="size-4" aria-hidden /> Reopen
        </button>
      )}
      {status === "PAID" && (
        <button
          type="button"
          disabled={pending}
          className={`${secondaryButton} text-danger hover:bg-red-50`}
          onClick={async () => {
            const yes = await confirm({ title: "Undo this payment?", message: "Use this only for a payment entered by mistake. Its accounting entry is removed and the payroll goes back to Approved.", confirmLabel: "Undo payment", tone: "danger" });
            if (yes) run(() => undoPayrollPayment(companySlug, runId), "Payment undone.");
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> Undo payment
        </button>
      )}
      {status !== "PAID" && (
        <button
          type="button"
          disabled={pending}
          title="Delete payroll"
          aria-label="Delete payroll"
          className="inline-flex size-10 items-center justify-center rounded-lg border border-border text-muted hover:border-red-200 hover:bg-red-50 hover:text-danger"
          onClick={async () => {
            const yes = await confirm({ title: `Delete the ${label} payroll?`, message: "Nothing has been paid yet, so nothing changes in the accounts.", confirmLabel: "Delete", tone: "danger" });
            if (yes) run(() => deletePayrollRun(companySlug, runId), "Payroll deleted.");
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </>
  );
}

export function PayForm({ companySlug, runId, total, accounts }: { companySlug: string; runId: string; total: number; accounts: MoneyAccountOption[] }) {
  const [state, formAction, pending] = useActionState<PayrollFormState, FormData>(payPayroll.bind(null, companySlug, runId), {});
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <p className="rounded-lg bg-background p-3 text-sm">
        Net to pay: <span className="tabular font-semibold text-navy">{formatMoney(total)}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Paid on *
          <input name="payDate" type="date" required defaultValue={today()} className={inputClass} />
        </label>
        <label className={labelClass}>
          Paid from *
          <select name="moneyAccountId" required defaultValue={accounts.find((a) => a.kind === "CASH")?.id ?? accounts[0]?.id} className={inputClass}>
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
        {pending ? "Saving…" : "Record payment"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
