"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { replyToCustomer, setThreadStatus, type InboxState } from "@/lib/actions/portal-inbox";
import { useFeedback } from "@/components/feedback";
import { FormMessage, Kbd, inputClass, primaryButton, secondaryButton, secondaryButtonSm } from "@/components/ui";

/** Answer in the conversation; the customer sees it in their portal (and can be told on WhatsApp). */
export function StaffReplyForm({ companySlug, threadId, whatsapp }: { companySlug: string; threadId: string; whatsapp: string | null }) {
  const [state, formAction, pending] = useActionState<InboxState, FormData>(replyToCustomer.bind(null, companySlug, threadId), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.done) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={formAction} data-save-shortcut className="space-y-2">
      <textarea name="body" required rows={4} maxLength={4000} placeholder="Your answer. The customer sees it in their portal." aria-label="Your answer" className={inputClass} autoFocus />
      <FormMessage error={state.error} success={state.done ? "Sent. It's in the customer's portal now." : undefined} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="close" value="1" className="size-4 accent-brand" /> Close the conversation after sending
        </label>
        <div className="flex gap-2">
          {state.done && whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener" className={secondaryButton}>
              <MessageCircle className="size-4" aria-hidden /> Tell them on WhatsApp
            </a>
          )}
          <button type="submit" disabled={pending} className={`${primaryButton} gap-2`}>
            {pending ? "Sending…" : "Send answer"}
            <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
          </button>
        </div>
      </div>
    </form>
  );
}

export function ThreadStatusButton({ companySlug, threadId, status }: { companySlug: string; threadId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();
  const next = status === "OPEN" ? "CLOSED" : "OPEN";
  return (
    <button
      type="button"
      disabled={pending}
      className={secondaryButtonSm}
      onClick={() =>
        startTransition(async () => {
          const res = await setThreadStatus(companySlug, threadId, next);
          if (res.error) toast.error(res.error);
          else toast.success(next === "CLOSED" ? "Conversation closed." : "Conversation reopened.");
        })
      }
    >
      {next === "CLOSED" ? "Close" : "Reopen"}
    </button>
  );
}
