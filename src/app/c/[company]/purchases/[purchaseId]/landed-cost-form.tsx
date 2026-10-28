"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { addLandedCost, type LandedCostState } from "@/lib/actions/purchases";
import { FormMessage, inputClass, secondaryButton } from "@/components/ui";

const SUGGESTIONS = ["Sea freight", "Air freight", "Customs duty", "Clearing agent", "Port charges", "Insurance", "Local transport"];

export function LandedCostForm({ companySlug, purchaseId }: { companySlug: string; purchaseId: string }) {
  const [state, formAction, pending] = useActionState<LandedCostState, FormData>(addLandedCost.bind(null, companySlug, purchaseId), {});
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <input name="description" list="landed-suggestions" required maxLength={200} placeholder="e.g. Customs duty" aria-label="Landed cost description" className={`${inputClass} h-9 max-w-xs`} />
        <datalist id="landed-suggestions">
          {SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Amount excl. VAT" aria-label="Landed cost amount" className={`${inputClass} h-9 w-40`} />
        <button type="submit" disabled={pending} className={`${secondaryButton} h-9`}>
          <Plus className="size-4" aria-hidden /> {pending ? "Adding…" : "Add cost"}
        </button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}
