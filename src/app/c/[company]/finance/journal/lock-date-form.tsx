"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { saveLockDate, type LockDateState } from "@/lib/actions/finance";
import { FormMessage, secondaryButtonSm } from "@/components/ui";

/** Close the books up to a date: no document can post on or before it. Empty reopens everything. */
export function LockDateForm({ companySlug, current, maxDate }: { companySlug: string; current: string | null; maxDate: string }) {
  const [state, formAction, pending] = useActionState<LockDateState, FormData>(saveLockDate.bind(null, companySlug), {});
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-muted">
          <span className="flex items-center gap-1">
            <Lock className="size-3.5" aria-hidden /> Books closed up to
          </span>
          <input
            type="date"
            name="lockDate"
            defaultValue={current ?? ""}
            max={maxDate}
            className="mt-1 block h-9 w-44 rounded-lg border border-border bg-surface px-2 text-sm"
          />
        </label>
        <button type="submit" disabled={pending} className={secondaryButtonSm}>
          {pending ? "Saving…" : "Save lock date"}
        </button>
      </div>
      <p className="text-xs text-muted">Nothing can be posted on or before this date. Leave it empty to keep every period open.</p>
      <FormMessage error={state.error} success={state.saved} />
    </form>
  );
}
