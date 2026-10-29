"use client";

import { useState, useTransition } from "react";
import { Copy, Mail, MessageCircle, Send } from "lucide-react";
import { prepareSend, type SendKind, type SendResult } from "@/lib/actions/send";
import { useFeedback } from "@/components/feedback";
import { secondaryButton } from "@/components/ui";

/** WhatsApp wants the number in international form, digits only (Lebanon: 961…). */
function waNumber(phone: string | null | undefined) {
  let d = (phone ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `961${d.slice(1)}`;
  else if (d.length === 7 || d.length === 8) d = `961${d}`;
  return d;
}

/**
 * "Send": prepares a message with a private link to the document, then opens WhatsApp or the
 * email app with it ready to send (or copies the link).
 */
export function SendButton({ companySlug, kind, id, label = "Send" }: { companySlug: string; kind: SendKind; id: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState<SendResult | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();

  const prepare = () =>
    startTransition(async () => {
      const res = await prepareSend(companySlug, kind, id);
      if (res.error) {
        toast.error(res.error);
        setOpen(false);
      } else setReady(res);
    });

  return (
    <div className="relative">
      <button
        type="button"
        className={secondaryButton}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!ready) prepare();
        }}
      >
        <Send className="size-4" aria-hidden /> {label}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-border bg-surface p-1 shadow-lg">
          {pending || !ready ? (
            <p className="px-3 py-2 text-sm text-muted">Preparing the link…</p>
          ) : (
            <>
              <a
                role="menuitem"
                href={`https://wa.me/${waNumber(ready.phone)}?text=${encodeURIComponent(ready.message ?? "")}`}
                target="_blank"
                rel="noopener"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-2"
              >
                <MessageCircle className="size-4 text-success" aria-hidden />
                <span>
                  WhatsApp
                  <span className="block text-xs text-muted">{ready.phone ? ready.phone : "choose the contact in WhatsApp"}</span>
                </span>
              </a>
              <a
                role="menuitem"
                href={`mailto:${ready.email ?? ""}?subject=${encodeURIComponent(ready.subject ?? "")}&body=${encodeURIComponent(ready.message ?? "")}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-2"
              >
                <Mail className="size-4 text-brand" aria-hidden />
                <span>
                  Email
                  <span className="block text-xs text-muted">{ready.email ?? "no email saved"}</span>
                </span>
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(ready.url ?? "");
                    toast.success("Link copied.");
                  } catch {
                    toast.info(ready.url ?? "");
                  }
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <Copy className="size-4 text-muted" aria-hidden /> Copy link
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
