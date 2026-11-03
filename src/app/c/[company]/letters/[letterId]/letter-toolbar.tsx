"use client";

import { useEffect } from "react";
import { Kbd, primaryButton, secondaryButton } from "@/components/ui";

/** PDF actions for a saved letter. Ctrl+P opens the PDF instead of printing the page. */
export function LetterToolbar({ companySlug, letterId }: { companySlug: string; letterId: string }) {
  const pdfUrl = `/c/${companySlug}/letters/${letterId}/pdf`;

  useEffect(() => {
    // Effects are removed while this page is hidden in the background, so this only
    // reacts when the letter is the page on screen.
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
    <>
      <a href={pdfUrl} target="_blank" rel="noopener" className={`${primaryButton} gap-2`}>
        Open PDF <Kbd className="border-white/30 bg-white/10 text-white">Ctrl P</Kbd>
      </a>
      <a href={`${pdfUrl}?download=1`} className={secondaryButton}>
        Download PDF
      </a>
    </>
  );
}
