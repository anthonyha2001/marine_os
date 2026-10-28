"use client";

import { useEffect } from "react";

/** Ctrl+P opens this document's PDF instead of printing the page. */
export function PdfShortcut({ url }: { url: string }) {
  useEffect(() => {
    // Effects stop while this page is hidden in the background, so this only fires on screen.
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.open(url, "_blank", "noopener");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url]);
  return null;
}
