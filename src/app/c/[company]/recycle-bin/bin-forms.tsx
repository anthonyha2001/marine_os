"use client";

import { useActionState, useTransition } from "react";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { emptyDatabase, purgeBinItem, restoreBinItem, type EmptyState } from "@/lib/actions/recycle";
import { useFeedback } from "@/components/feedback";
import { FormMessage, dangerButton, inputClass, labelClass, secondaryButtonSm } from "@/components/ui";

/** Restore (anyone with the recycle bin) and delete for good (admin). */
export function BinActions({ companySlug, itemId, label, canPurge }: { companySlug: string; itemId: string; label: string; canPurge: boolean }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  const run = (action: () => Promise<{ error?: string }>, done: string) =>
    startTransition(async () => {
      const res = await action();
      if (res.error) toast.error(res.error);
      else toast.success(done);
    });
  return (
    <div className="flex justify-end gap-1.5">
      <button type="button" disabled={pending} onClick={() => run(() => restoreBinItem(companySlug, itemId), `${label} restored.`)} className={`${secondaryButtonSm} gap-1.5`}>
        <ArchiveRestore className="size-3.5" aria-hidden /> Restore
      </button>
      {canPurge && (
        <button
          type="button"
          disabled={pending}
          title="Delete for good"
          aria-label={`Delete ${label} for good`}
          onClick={async () => {
            const ok = await confirm({ title: "Delete for good?", message: `${label} will be removed from the recycle bin and can't be restored.`, confirmLabel: "Delete for good", tone: "danger" });
            if (ok) run(() => purgeBinItem(companySlug, itemId), "Deleted for good.");
          }}
          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Admin only: wipe all business data, after the password and the word EMPTY. */
export function EmptyDatabaseForm({ companySlug }: { companySlug: string }) {
  const [state, formAction, pending] = useActionState<EmptyState, FormData>(emptyDatabase.bind(null, companySlug), {});
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" autoComplete="off">
      <label className={labelClass}>
        Your password
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </label>
      <label className={labelClass}>
        Type EMPTY to confirm
        <input name="confirm" required autoComplete="off" spellCheck={false} placeholder="EMPTY" className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={dangerButton}>
        {pending ? "Emptying…" : "Empty the database"}
      </button>
      <div className="sm:col-span-3">
        <FormMessage error={state.error} />
      </div>
    </form>
  );
}
