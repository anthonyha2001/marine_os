"use client";

import { useActionState, useTransition } from "react";
import { Ban, CheckCircle2, Play, RotateCcw, Trash2 } from "lucide-react";
import { deleteJobCard, invoiceJobCard, setJobCardStatus, type WorkshopFormState } from "@/lib/actions/workshop";
import type { JobStatus } from "@/lib/data/workshop";
import { useFeedback } from "@/components/feedback";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButton, secondaryButtonSm } from "@/components/ui";

/** Status buttons: start, done (parts leave stock), reopen, cancel, delete. */
export function JobActions({ companySlug, jobId, number, status, hasInvoices }: { companySlug: string; jobId: string; number: string; status: JobStatus; hasInvoices: boolean }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  const run = (fn: () => Promise<{ error?: string } | void>, ok: string) =>
    startTransition(async () => {
      try {
        const res = await fn();
        if (res && res.error) toast.error(res.error);
        else toast.success(ok);
      } catch (e) {
        if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
        toast.error("Something went wrong. Check your connection and try again.");
      }
    });

  return (
    <>
      {status === "OPEN" && (
        <button type="button" disabled={pending} className={secondaryButton} onClick={() => run(() => setJobCardStatus(companySlug, jobId, "IN_PROGRESS"), "Work started.")}>
          <Play className="size-4" aria-hidden /> Start work
        </button>
      )}
      {(status === "OPEN" || status === "IN_PROGRESS") && (
        <button
          type="button"
          disabled={pending}
          className={primaryButton}
          onClick={async () => {
            const ok = await confirm({ title: `Mark ${number} as done?`, message: "Save your changes first. Parts from the catalogue are taken out of stock.", confirmLabel: "Mark as done" });
            if (ok) run(() => setJobCardStatus(companySlug, jobId, "DONE"), "Job card done.");
          }}
        >
          <CheckCircle2 className="size-4" aria-hidden /> Mark as done
        </button>
      )}
      {(status === "DONE" || status === "CANCELLED") && (
        <button type="button" disabled={pending} className={secondaryButton} onClick={() => run(() => setJobCardStatus(companySlug, jobId, "IN_PROGRESS"), "Job card reopened.")}>
          <RotateCcw className="size-4" aria-hidden /> Reopen
        </button>
      )}
      {status !== "CANCELLED" && !hasInvoices && (
        <button
          type="button"
          disabled={pending}
          className={`${secondaryButton} text-danger hover:bg-red-50`}
          onClick={async () => {
            const ok = await confirm({ title: `Cancel ${number}?`, message: "The job card stays on file, marked cancelled. Parts taken from stock are put back.", confirmLabel: "Cancel job card", tone: "danger" });
            if (ok) run(() => setJobCardStatus(companySlug, jobId, "CANCELLED"), "Job card cancelled.");
          }}
        >
          <Ban className="size-4" aria-hidden /> Cancel
        </button>
      )}
      {!hasInvoices && (
        <button
          type="button"
          disabled={pending}
          title="Delete job card"
          aria-label="Delete job card"
          className="inline-flex size-10 items-center justify-center rounded-lg border border-border text-muted hover:border-red-200 hover:bg-red-50 hover:text-danger"
          onClick={async () => {
            const ok = await confirm({ title: `Delete ${number}?`, message: "Use this only for a job card opened by mistake.", confirmLabel: "Delete", tone: "danger" });
            if (ok) run(() => deleteJobCard(companySlug, jobId), "Job card deleted.");
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </>
  );
}

export function InvoiceJobForm({ companySlug, jobId, amount, returnTo }: { companySlug: string; jobId: string; amount: string; returnTo?: string }) {
  const [state, formAction, pending] = useActionState<WorkshopFormState, FormData>(invoiceJobCard.bind(null, companySlug, jobId), {});
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <p className="rounded-lg bg-background p-3 text-sm">
        The invoice will list the job card&apos;s billable lines: <span className="font-semibold text-navy">{amount}</span>
      </p>
      <label className={labelClass}>
        Payment due in (days)
        <input name="dueDays" type="number" min="0" max="365" defaultValue="0" className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Creating…" : "Create invoice"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

/** Small Start / Done / Reopen buttons for a job card shown as a card or in a pop-up. */
export function JobQuickActions({ companySlug, jobId, number, status }: { companySlug: string; jobId: string; number: string; status: JobStatus }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  const set = (next: JobStatus, ok: string) =>
    startTransition(async () => {
      const res = await setJobCardStatus(companySlug, jobId, next).catch(() => ({ error: "Something went wrong. Check your connection and try again." }));
      if (res.error) toast.error(res.error);
      else toast.success(ok);
    });
  return (
    <>
      {status === "OPEN" && (
        <button type="button" disabled={pending} className={secondaryButtonSm} onClick={() => set("IN_PROGRESS", `${number}: work started.`)}>
          <Play className="size-3.5" aria-hidden /> Start
        </button>
      )}
      {(status === "OPEN" || status === "IN_PROGRESS") && (
        <button
          type="button"
          disabled={pending}
          className={secondaryButtonSm}
          onClick={async () => {
            if (await confirm({ title: `Mark ${number} as done?`, message: "Parts from the catalogue are taken out of stock.", confirmLabel: "Mark as done" })) set("DONE", `${number} done.`);
          }}
        >
          <CheckCircle2 className="size-3.5 text-success" aria-hidden /> Done
        </button>
      )}
      {status === "DONE" && (
        <button type="button" disabled={pending} className={secondaryButtonSm} onClick={() => set("IN_PROGRESS", `${number} reopened.`)}>
          <RotateCcw className="size-3.5" aria-hidden /> Reopen
        </button>
      )}
    </>
  );
}
