"use client";

import { useOptimistic, useTransition } from "react";
import { useFeedback } from "@/components/feedback";
import { setOfferStatus } from "@/lib/actions/offers";
import { OFFER_STATUSES, type OfferStatus } from "@/lib/offers";

const STATUS_STYLE: Record<OfferStatus, string> = {
  DRAFT: "bg-gray-100 text-muted",
  SENT: "bg-blue-50 text-brand",
  ACCEPTED: "bg-green-50 text-success",
  REJECTED: "bg-red-50 text-danger",
};

/** Change an offer's status straight from the list; saves on change. */
export function StatusSelect({ companySlug, offerId, status }: { companySlug: string; offerId: string; status: OfferStatus }) {
  const [shown, setShown] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();

  return (
    <select
      value={shown}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as OfferStatus;
        startTransition(async () => {
          setShown(next);
          try {
            await setOfferStatus(companySlug, offerId, next);
          } catch {
            toast.error("The status couldn't be saved. Check your connection and try again.");
          }
        });
      }}
      aria-label="Offer status"
      className={`cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-medium outline-none focus:ring-2 focus:ring-brand/30 ${STATUS_STYLE[shown]}`}
    >
      {Object.entries(OFFER_STATUSES).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
