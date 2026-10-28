"use client";

import { useOptimistic, useTransition } from "react";
import { useFeedback } from "@/components/feedback";
import { setPurchaseOrderStatus } from "@/lib/actions/purchase-orders";

const STYLE = {
  DRAFT: "bg-gray-100 text-muted",
  SENT: "bg-blue-50 text-brand",
  RECEIVED: "bg-green-50 text-success",
  CANCELLED: "bg-red-50 text-danger",
} as const;
const LABEL = { DRAFT: "Draft", SENT: "Sent", RECEIVED: "Received", CANCELLED: "Cancelled" } as const;
type Status = keyof typeof STYLE;

/** Draft / Sent / Cancelled from the list. Received orders show a fixed badge. */
export function PoStatusSelect({ companySlug, orderId, status }: { companySlug: string; orderId: string; status: Status }) {
  const [shown, setShown] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();

  if (status === "RECEIVED") {
    return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLE.RECEIVED}`}>{LABEL.RECEIVED}</span>;
  }

  return (
    <select
      value={shown}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as "DRAFT" | "SENT" | "CANCELLED";
        startTransition(async () => {
          setShown(next);
          try {
            await setPurchaseOrderStatus(companySlug, orderId, next);
          } catch {
            toast.error("The status couldn't be saved. Check your connection and try again.");
          }
        });
      }}
      aria-label="Purchase order status"
      className={`cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-medium outline-none focus:ring-2 focus:ring-brand/30 ${STYLE[shown]}`}
    >
      {(["DRAFT", "SENT", "CANCELLED"] as const).map((s) => (
        <option key={s} value={s}>
          {LABEL[s]}
        </option>
      ))}
    </select>
  );
}
