"use client";

import { useEffect } from "react";
import { duplicateOffer } from "@/lib/actions/offers";
import { Kbd, primaryButton, secondaryButton } from "@/components/ui";

/** PDF and copy actions for a saved offer. Ctrl+P opens the PDF instead of printing the page. */
export function OfferToolbar({ companySlug, offerId }: { companySlug: string; offerId: string }) {
  const pdfUrl = `/c/${companySlug}/offers/${offerId}/pdf`;

  useEffect(() => {
    // Effects are removed while this page is hidden in the background, so this only
    // reacts when the offer is the page on screen.
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.open(pdfUrl, "_blank", "noopener");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pdfUrl]);

  return (
    <div className="flex flex-wrap gap-2">
      <a href={pdfUrl} target="_blank" rel="noopener" className={`${primaryButton} gap-2`}>
        Open PDF <Kbd className="border-white/30 bg-white/10 text-white">Ctrl P</Kbd>
      </a>
      <a href={`${pdfUrl}?download=1`} className={secondaryButton}>
        Download PDF
      </a>
      <form action={duplicateOffer.bind(null, companySlug, offerId)}>
        <button type="submit" className={secondaryButton}>
          Duplicate
        </button>
      </form>
    </div>
  );
}
