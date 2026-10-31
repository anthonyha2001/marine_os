"use client";

import { useEffect, useRef, useState } from "react";

/** Small menu anchored to a button; closes on outside click or Esc. */
export function Dropdown({
  button,
  label,
  children,
  align = "right",
  width = "w-72",
  openEvent,
}: {
  button: React.ReactNode;
  label: string;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: string;
  openEvent?: string; // window event that opens it (e.g. a keyboard shortcut)
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openEvent) return;
    const onOpen = () => setOpen(true);
    window.addEventListener(openEvent, onOpen);
    return () => window.removeEventListener(openEvent, onOpen);
  }, [openEvent]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-lg px-2 text-slate-600 transition hover:bg-surface-2 hover:text-navy"
      >
        {button}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute top-11 z-50 ${align === "right" ? "right-0" : "left-0"} ${width} overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-slate-900/10`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
