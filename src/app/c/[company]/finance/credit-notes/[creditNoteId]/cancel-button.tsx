"use client";

import { useTransition } from "react";
import { Ban } from "lucide-react";
import { cancelCreditNote } from "@/lib/actions/finance";
import { useFeedback } from "@/components/feedback";
import { secondaryButton } from "@/components/ui";

export function CancelCreditNoteButton({ companySlug, creditNoteId, number }: { companySlug: string; creditNoteId: string; number: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  return (
    <button
      type="button"
      disabled={pending}
      className={`${secondaryButton} text-danger hover:bg-red-50`}
      onClick={async () => {
        const ok = await confirm({
          title: `Cancel credit note ${number}?`,
          message: "Its accounting entry is reversed and the invoice balance goes back up. The credit note stays on file, marked cancelled.",
          confirmLabel: "Cancel credit note",
          cancelLabel: "Keep it",
          tone: "danger",
        });
        if (!ok) return;
        startTransition(async () => {
          try {
            const res = await cancelCreditNote(companySlug, creditNoteId);
            if (res.error) toast.error(res.error);
            else toast.success("Credit note cancelled.");
          } catch {
            toast.error("The credit note couldn't be cancelled. Check your connection and try again.");
          }
        });
      }}
    >
      <Ban className="size-4" aria-hidden /> Cancel
    </button>
  );
}
