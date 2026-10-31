"use client";

import { useRouter } from "next/navigation";

/**
 * A table row that opens `href` (usually a pop-up kept in the URL) on double-click.
 * Double-clicks on the row's own links, buttons and fields still do their normal job.
 */
export function OpenRow({ href, className, children }: { href?: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  if (!href) return <tr className={className}>{children}</tr>;
  return (
    <tr
      className={`${className ?? ""} cursor-pointer`}
      data-open-href={href}
      title="Double-click to see what's inside"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
        window.getSelection()?.removeAllRanges(); // a double-click also selects a word
        router.replace(href, { scroll: false });
      }}
    >
      {children}
    </tr>
  );
}
