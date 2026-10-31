"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Keyboard } from "lucide-react";
import { activePage, type NavGroup } from "@/lib/navigation";
import { NAV_ICONS } from "./nav-icons";

/** Dark navigation rail: one link per section (its pages are tabs on the page). Can shrink to icons only. */
export function Sidebar({
  base,
  groups,
  logo,
  companyName,
  collapsed = false,
  onNavigate,
}: {
  base: string;
  groups: NavGroup[];
  logo: string;
  companyName: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = activePage(groups, base, pathname)?.group.title;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <Link href={`${base}/dashboard`} onClick={onNavigate} className={`block ${collapsed ? "px-2 pb-3 pt-4" : "px-4 pb-4 pt-5"}`}>
        <span className={`flex items-center justify-center rounded-xl bg-white shadow-sm ${collapsed ? "h-12 p-1.5" : "h-[72px] px-4 py-2"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- logos are served as-is (AVIF) */}
          <img src={logo} alt={companyName} className={`w-auto max-w-full object-contain ${collapsed ? "max-h-9" : "max-h-14"}`} />
        </span>
      </Link>

      <nav className={`flex-1 overflow-y-auto pb-4 ${collapsed ? "px-2" : "px-3"}`} aria-label="Main">
        <ul className="space-y-0.5">
          {groups.map((group) => {
            const first = group.items[0];
            const href = `${base}/${first.path}`;
            const isActive = group.title === active;
            const Icon = NAV_ICONS[group.icon];
            const shortcut = group.items.length === 1 ? first.shortcut : undefined;
            return (
              <li key={group.title}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  title={collapsed || shortcut ? `${group.title}${shortcut ? ` (${shortcut})` : ""}` : undefined}
                  aria-label={collapsed ? group.title : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-lg py-2.5 text-[14px] font-medium transition ${collapsed ? "justify-center px-0" : "px-3"} ${
                    isActive ? "bg-sidebar-active text-white" : "hover:bg-sidebar-hover hover:text-white"
                  }`}
                >
                  {isActive && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand" aria-hidden />}
                  <Icon className={`size-[19px] shrink-0 ${isActive ? "text-white" : "text-sidebar-muted group-hover:text-white"}`} aria-hidden />
                  {!collapsed && group.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={`space-y-0.5 border-t border-white/5 py-2 ${collapsed ? "px-2" : "px-3"}`}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("marine:shortcuts"))}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          className={`flex w-full items-center gap-2 rounded-lg py-2 text-xs text-sidebar-muted transition hover:bg-sidebar-hover hover:text-white ${collapsed ? "justify-center" : "px-3"}`}
        >
          <Keyboard className="size-4" aria-hidden />
          {!collapsed && (
            <>
              Keyboard shortcuts
              <span className="ml-auto rounded border border-white/15 px-1.5 font-mono text-[10px]">?</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
