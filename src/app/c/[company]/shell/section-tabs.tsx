"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activePage, type NavGroup } from "@/lib/navigation";

/** The pages of the current sidebar section, as tabs above the page. Shown on list pages only, not on a document. */
export function SectionTabs({ base, groups }: { base: string; groups: NavGroup[] }) {
  const pathname = usePathname();
  const current = activePage(groups, base, pathname);
  if (!current || current.group.items.length < 2 || current.href !== pathname) return null;

  return (
    <nav aria-label={`${current.group.title} pages`} className="-mt-2 mb-5 flex gap-1 overflow-x-auto border-b border-border">
      {current.group.items.map((item) => {
        const href = `${base}/${item.path}`;
        const on = href === current.href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
              on ? "border-brand text-navy" : "border-transparent text-muted hover:border-slate-300 hover:text-navy"
            }`}
          >
            {item.tab ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
