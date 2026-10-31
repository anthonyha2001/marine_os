"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activePage, type NavGroup } from "@/lib/navigation";

/** The pages of the current sidebar section, as tabs above the page. Shown on list pages only, not on a document. */
export function SectionTabs({ base, groups, counts = {} }: { base: string; groups: NavGroup[]; counts?: Record<string, number> }) {
  const pathname = usePathname();
  const current = activePage(groups, base, pathname);
  if (!current || current.group.items.length < 2 || current.href !== pathname) return null;

  return (
    <nav aria-label={`${current.group.title} pages`} className="sticky top-14 z-20 -mx-4 -mt-6 mb-5 flex gap-1 overflow-x-auto bg-background/95 px-4 pt-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {current.group.items.map((item) => {
        const href = `${base}/${item.path}`;
        const on = href === current.href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            title="Ctrl + ← / → to switch tabs"
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
              on ? "border-brand text-navy" : "border-transparent text-muted hover:border-slate-300 hover:text-navy"
            }`}
          >
            {item.tab ?? item.label}
            {(counts[item.path] ?? 0) > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">{counts[item.path]}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
