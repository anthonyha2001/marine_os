"use client";

import { useTransition } from "react";
import { Link2 } from "lucide-react";
import { disablePortalLink, resetPortalLink, shareOffer } from "@/lib/actions/portal-links";
import { useFeedback } from "@/components/feedback";
import { secondaryButton } from "@/components/ui";

async function copy(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/** Copy the private link for an offer, so the customer can accept it online. */
export function ShareOfferButton({ companySlug, offerId }: { companySlug: string; offerId: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();
  return (
    <button
      type="button"
      disabled={pending}
      className={secondaryButton}
      onClick={() =>
        startTransition(async () => {
          const res = await shareOffer(companySlug, offerId);
          if (res.error || !res.token) return toast.error(res.error ?? "The link couldn't be created.");
          const url = `${window.location.origin}/p/o/${res.token}`;
          toast.success((await copy(url)) ? "Link copied — paste it in WhatsApp or an email." : `Link: ${url}`);
        })
      }
    >
      <Link2 className="size-4" aria-hidden /> Share for approval
    </button>
  );
}

/** Customer portal link: copy it (creating it the first time), or replace / disable it. */
export function PortalLinkButton({ companySlug, customerId, hasLink, token }: { companySlug: string; customerId: string; hasLink: boolean; token: string | null }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  const copyLink = (t: string) =>
    startTransition(async () => {
      const url = `${window.location.origin}/p/${t}`;
      toast.success((await copy(url)) ? "Portal link copied — send it to the customer." : `Link: ${url}`);
    });
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        title={hasLink ? "Copy portal link" : "Create portal link"}
        aria-label={hasLink ? "Copy portal link" : "Create portal link"}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy"
        onClick={() => {
          if (hasLink && token) return copyLink(token);
          startTransition(async () => {
            const res = await resetPortalLink(companySlug, customerId);
            if (res.error || !res.token) return toast.error(res.error ?? "The link couldn't be created.");
            const url = `${window.location.origin}/p/${res.token}`;
            toast.success((await copy(url)) ? "Portal link created and copied." : `Link: ${url}`);
          });
        }}
      >
        <Link2 className={`size-4 ${hasLink ? "text-brand" : ""}`} aria-hidden />
      </button>
      {hasLink && (
        <button
          type="button"
          disabled={pending}
          className="text-xs text-muted hover:text-danger"
          onClick={async () => {
            if (!(await confirm({ title: "Disable the portal link?", message: "The current link stops working. You can create a new one later.", confirmLabel: "Disable", tone: "danger" }))) return;
            startTransition(async () => {
              await disablePortalLink(companySlug, customerId);
              toast.success("Portal link disabled.");
            });
          }}
        >
          disable
        </button>
      )}
    </span>
  );
}
