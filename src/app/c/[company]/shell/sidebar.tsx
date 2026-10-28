"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Anchor, Keyboard } from "lucide-react";
import type { NavGroup } from "@/lib/navigation";
import { NAV_ICONS } from "./nav-icons";

/** Dark navigation rail: logo, grouped links with icons; shortcuts live in tooltips. */
export function Sidebar({
  base,
  groups,
  logo,
  companyName,
  onNavigate,
}: {
  base: string;
  groups: NavGroup[];
  logo: string;
  companyName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const hrefs = groups.flatMap((g) => g.items.map((i) => `${base}/${i.path}`));
  // Most specific match wins, so "Purchases" isn't highlighted on "Purchase orders".
  const active = hrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <Link href={`${base}/dashboard`} onClick={onNavigate} className="block px-4 pb-4 pt-5">
        <span className="flex h-[72px] items-center justify-center rounded-xl bg-white px-4 py-2 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- logos are served as-is (AVIF) */}
          <img src={logo} alt={companyName} className="max-h-14 w-auto max-w-full object-contain" />
        </span>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main">
        {groups.map((group, gi) => (
          <div key={group.title ?? gi}>
            {group.title && (
              <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">{group.title}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const href = `${base}/${item.path}`;
                const isActive = href === active;
                const Icon = item.icon ? NAV_ICONS[item.icon] : Anchor;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
                      aria-current={isActive ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition ${
                        isActive ? "bg-sidebar-active text-white" : "hover:bg-sidebar-hover hover:text-white"
                      }`}
                    >
                      {isActive && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand" aria-hidden />}
                      <Icon className={`size-[18px] shrink-0 ${isActive ? "text-white" : "text-sidebar-muted group-hover:text-white"}`} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("marine:shortcuts"))}
        className="mx-3 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-muted transition hover:bg-sidebar-hover hover:text-white"
      >
        <Keyboard className="size-4" aria-hidden />
        Keyboard shortcuts
        <span className="ml-auto rounded border border-white/15 px-1.5 font-mono text-[10px]">?</span>
      </button>
      <p className="border-t border-white/5 px-6 py-3 text-[11px] text-sidebar-muted">Marine OS</p>
    </div>
  );
}
