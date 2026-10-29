"use client";

import { useTransition } from "react";
import { Ban, Undo2 } from "lucide-react";
import { useFeedback } from "@/components/feedback";

/**
 * Cancel (or reverse) a posted entry: asks for the reason in the in-app dialog, then runs the
 * action. The entry stays on record, stamped CANCELLED, with a reversing journal entry.
 */
export function CancelButton({
  action,
  title,
  message,
  reverse = false,
}: {
  action: (reason: string) => Promise<{ error?: string }>;
  title: string;
  message: string;
  /** "Reverse" wording and icon (journal entries). */
  reverse?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const { askReason, toast } = useFeedback();
  const Icon = reverse ? Undo2 : Ban;
  return (
    <button
      type="button"
      disabled={pending}
      title={title}
      aria-label={title}
      onClick={async () => {
        const reason = await askReason({ title: `${title}?`, message, confirmLabel: reverse ? "Reverse" : "Cancel it", cancelLabel: "Keep", tone: "danger", reasonLabel: "Reason" });
        if (!reason) return;
        startTransition(async () => {
          const res = await action(reason);
          if (res.error) toast.error(res.error);
          else toast.success(reverse ? "Reversed. A reversing entry was posted." : "Cancelled. A reversing entry was posted.");
        });
      }}
      className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
    >
      <Icon className={`size-4 ${pending ? "animate-pulse" : ""}`} aria-hidden />
    </button>
  );
}

/** Red "Cancelled" note with who and why. */
export function CancelledNote({ by, reason }: { by: string | null; reason: string | null }) {
  return (
    <span className="mt-0.5 block text-xs font-medium text-danger">
      Cancelled{by ? ` by ${by}` : ""}
      {reason ? `: ${reason}` : ""}
    </span>
  );
}
