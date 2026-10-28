"use client";

import { useActionState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { respondToOffer, type PortalState } from "@/lib/actions/portal";
import { FormMessage, inputClass, labelClass, primaryButton, secondaryButton } from "@/components/ui";

type Where = { shareToken: string } | { portalToken: string; offerId: string };

/** Accept or decline, with the name of the person answering and an optional note. */
export function OfferResponse({ where }: { where: Where }) {
  const [accepted, accept, accepting] = useActionState<PortalState, FormData>(respondToOffer.bind(null, where, "ACCEPT"), {});
  const [declined, decline, declining] = useActionState<PortalState, FormData>(respondToOffer.bind(null, where, "DECLINE"), {});
  if (accepted.done || declined.done) {
    return (
      <p role="status" className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${accepted.done ? "border-green-200 bg-green-50 text-success" : "border-border bg-surface-2 text-navy"}`}>
        {accepted.done ? <CheckCircle2 className="size-5" aria-hidden /> : <XCircle className="size-5" aria-hidden />}
        {accepted.done ? "Thank you — your acceptance has been sent. We'll be in touch to schedule the work." : "Your answer has been sent. Thank you for considering our offer."}
      </p>
    );
  }
  return (
    <form className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Your name *
          <input name="name" required maxLength={120} autoComplete="name" className={inputClass} />
        </label>
        <label className={labelClass}>
          Note (optional)
          <input name="note" maxLength={1000} placeholder="e.g. Please start next week" className={inputClass} />
        </label>
      </div>
      <FormMessage error={accepted.error ?? declined.error} />
      <div className="flex flex-wrap gap-2">
        <button formAction={accept} disabled={accepting || declining} className={`${primaryButton} gap-2`}>
          <CheckCircle2 className="size-4" aria-hidden /> {accepting ? "Sending…" : "Accept the offer"}
        </button>
        <button formAction={decline} disabled={accepting || declining} className={`${secondaryButton} gap-2`}>
          <XCircle className="size-4" aria-hidden /> {declining ? "Sending…" : "Decline"}
        </button>
      </div>
    </form>
  );
}
