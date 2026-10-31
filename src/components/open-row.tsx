"use client";

import { useRouter } from "next/navigation";
import { useRowSelection } from "@/components/row-selection";

/**
 * A table row that opens `href` (usually a pop-up kept in the URL) on double-click.
 * With `selectId` inside a <RowSelection>, a single click selects it (Ctrl / Shift for more).
 * Clicks on the row's own links, buttons and fields still do their normal job.
 */
export function OpenRow({ href, selectId, className, children }: { href?: string; selectId?: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const selection = useRowSelection();
  const selectable = !!selectId && !!selection;
  const isSelected = selectable && selection.selected.includes(selectId);
  const own = (t: EventTarget) => !!(t as HTMLElement).closest("a, button, input, select, textarea, label");
  if (!href && !selectable) return <tr className={className}>{children}</tr>;
  return (
    <tr
      className={`${className ?? ""} cursor-pointer select-none ${isSelected ? "!bg-brand-soft shadow-[inset_3px_0_0_var(--brand)]" : ""}`}
      aria-selected={selectable ? isSelected : undefined}
      data-open-href={href}
      title={selectable ? "Click to select (Ctrl / Shift for more) · double-click to open" : "Double-click to see what's inside"}
      onClick={(e) => {
        // The second click of a double-click opens the row; don't let it undo the selection.
        if (!selectable || e.detail > 1 || own(e.target)) return;
        selection.pick(selectId, e);
      }}
      onDoubleClick={(e) => {
        if (!href || own(e.target)) return;
        window.getSelection()?.removeAllRanges(); // a double-click also selects a word
        router.replace(href, { scroll: false });
      }}
    >
      {children}
    </tr>
  );
}
