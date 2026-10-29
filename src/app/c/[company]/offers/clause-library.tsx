"use client";

import { useActionState } from "react";
import { deleteClause, saveClause, type OfferFormState } from "@/lib/actions/offers";
import { DeleteButton } from "@/components/delete-button";
import { FormMessage, inputClass, labelClass, primaryButton } from "@/components/ui";

/** Standard terms you insert into any offer with one click (warranty wording, payment, validity…). */
export function ClauseLibrary({ companySlug, clauses }: { companySlug: string; clauses: { id: string; title: string; text: string }[] }) {
  const [state, formAction, pending] = useActionState<OfferFormState, FormData>(saveClause.bind(null, companySlug), {});
  return (
    <div className="space-y-5">
      {clauses.length === 0 ? (
        <p className="text-sm text-muted">No standard clauses yet. Add the ones you repeat on every offer.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {clauses.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-navy">{c.title}</p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{c.text}</p>
              </div>
              <DeleteButton action={deleteClause.bind(null, companySlug, c.id)} confirmText={`Delete the clause "${c.title}"?`} title="Delete clause" />
            </li>
          ))}
        </ul>
      )}
      <form action={formAction} className="space-y-3 rounded-xl border border-border bg-surface-2 p-4">
        <h3 className="font-semibold text-navy">Add a clause</h3>
        <label className={labelClass}>
          Title
          <input name="title" required maxLength={120} placeholder="e.g. Engine warranty" className={inputClass} />
        </label>
        <label className={labelClass}>
          Text (one term per line)
          <textarea name="text" required rows={3} maxLength={5000} className={inputClass} />
        </label>
        <FormMessage error={state.error} />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : "Add clause"}
        </button>
      </form>
    </div>
  );
}
