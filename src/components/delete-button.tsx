"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useFeedback } from "@/components/feedback";

/**
 * Bin icon that asks for confirmation (in-app dialog), then runs a delete Server Action.
 * The action redirects on success; if it refuses (e.g. the item is still in use) the reason
 * is shown as a notification. `bordered` gives the larger outlined square used in page headers.
 */
export function DeleteButton({
  action,
  confirmText,
  title = "Delete",
  bordered = false,
  successMessage,
}: {
  action: () => Promise<{ error?: string } | void>;
  confirmText: string;
  title?: string;
  bordered?: boolean;
  successMessage?: string;
}) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();

  return (
    <button
      type="button"
      disabled={pending}
      title={title}
      aria-label={title}
      onClick={async () => {
        const ok = await confirm({ title: `${title}?`, message: confirmText, confirmLabel: "Delete", tone: "danger" });
        if (!ok) return;
        startTransition(async () => {
          try {
            const result = await action();
            if (result?.error) toast.error(result.error);
            else if (successMessage) toast.success(successMessage);
          } catch (e) {
            // A redirect after a successful delete surfaces here as a navigation, not an error.
            if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
            toast.error("It couldn't be deleted. Check your connection and try again.");
          }
        });
      }}
      className={
        bordered
          ? "inline-flex size-10 items-center justify-center rounded-lg border border-red-200 bg-surface text-danger transition hover:bg-red-50 disabled:opacity-50"
          : "inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-danger disabled:opacity-50"
      }
    >
      <Trash2 className={`size-4 ${pending ? "animate-pulse" : ""}`} aria-hidden />
    </button>
  );
}
