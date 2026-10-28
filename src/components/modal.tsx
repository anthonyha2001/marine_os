"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/feedback";

/**
 * A pop-up shown over its page. Either open/closed lives in the URL (e.g. ?new=1) and closing
 * goes to `closeHref`, or the parent controls it and passes `onClose` (used inside forms
 * that must keep their state). Esc or the backdrop closes it, asking first if a form inside
 * has unsaved input.
 */
export function Modal({
  title,
  closeHref,
  onClose,
  children,
  size = "lg",
}: {
  title: string;
  closeHref?: string;
  onClose?: () => void;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const { confirm } = useFeedback();

  const close = async () => {
    const dirty = panel.current?.querySelector("form[data-dirty='true']");
    if (dirty && !(await confirm({ title: "Discard your changes?", message: "What you've entered in this window will be lost.", confirmLabel: "Discard", tone: "danger" }))) return;
    if (onClose) onClose();
    else if (closeHref) router.replace(closeHref, { scroll: false });
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // First Esc leaves a focused field (the global shortcut handler does that); the next one closes.
      const active = document.activeElement as HTMLElement | null;
      if (active && panel.current?.contains(active) && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
      e.preventDefault();
      close();
    }
    window.addEventListener("keydown", onKey);
    // Keep the page behind from scrolling while the pop-up is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  });

  const width = { md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-navy-deep/40 p-4 sm:p-8" onMouseDown={close}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full ${width} rounded-2xl bg-background shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-4 sm:rounded-t-2xl">
          <h2 className="text-lg font-semibold text-navy">{title}</h2>
          <button type="button" onClick={close} className="rounded-lg px-2 py-1 text-muted hover:bg-background hover:text-navy" aria-label="Close">
            ✕ <span className="ml-1 text-xs">Esc</span>
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
