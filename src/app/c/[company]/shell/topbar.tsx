"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Check, ChevronDown, ChevronRight, Keyboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import type { NavGroup } from "@/lib/navigation";
import { Dropdown } from "./dropdown";

import type { Notice } from "@/lib/data/notices";
export type { Notice };
type CompanyOption = { slug: string; name: string; logo: string };

/** The sidebar page a path belongs to (longest matching path, e.g. "finance/cash") and how many segments it covers. */
function section(groups: NavGroup[], segments: string[]) {
  let best: { label: string; depth: number } | null = null;
  for (const g of groups)
    for (const i of g.items) {
      const parts = i.path.split("?")[0].split("/");
      if (parts.every((part, n) => segments[n] === part) && parts.length > (best?.depth ?? 0)) best = { label: i.label, depth: parts.length };
    }
  return best ?? { label: segments[0].replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()), depth: 1 };
}

export function Topbar({
  base,
  groups,
  company,
  companies,
  user,
  notices,
  onMenu,
  collapsed,
  onToggleMenu,
}: {
  base: string;
  groups: NavGroup[];
  company: CompanyOption;
  companies: CompanyOption[];
  user: { name: string; email: string; roleLabel: string };
  notices: Notice[];
  onMenu: () => void;
  collapsed: boolean;
  onToggleMenu: () => void;
}) {
  const pathname = usePathname();
  const rest = pathname.slice(base.length).split("/").filter(Boolean);
  const current = rest[0] && rest[0] !== "dashboard" ? section(groups, rest) : null;
  const detail = current ? rest[current.depth] : undefined;
  const crumbs = [
    { label: company.name, href: `${base}/dashboard` },
    ...(current ? [{ label: current.label, href: `${base}/${rest.slice(0, current.depth).join("/")}` }] : []),
    ...(detail ? [{ label: detail === "new" ? "New" : "Details", href: pathname }] : []),
  ];
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const creates = groups.map((g) => ({ title: g.title, items: g.items.filter((i) => i.create) })).filter((g) => g.items.length > 0);
  const urgent = notices.filter((n) => n.tone === "red").length;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-surface-2 lg:hidden" aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      <button
        type="button"
        onClick={onToggleMenu}
        title={collapsed ? "Show menu names" : "Shrink the menu to icons"}
        aria-label={collapsed ? "Expand menu" : "Collapse menu"}
        className="hidden rounded-lg p-2 text-slate-500 hover:bg-surface-2 hover:text-navy lg:block"
      >
        {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
      </button>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
        {crumbs.map((c, i) => (
          <span key={c.href + i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden />}
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium text-navy">{c.label}</span>
            ) : (
              <Link href={c.href} className="truncate text-muted hover:text-navy">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        {creates.length > 0 && (
          <Dropdown
            label="Create new"
            width="w-64"
            button={
              <span className="flex h-8 items-center gap-1.5 rounded-lg bg-navy px-3 text-sm font-medium text-white shadow-sm">
                <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">New</span>
              </span>
            }
          >
            {(close) => (
              <div className="max-h-[70vh] overflow-y-auto py-1.5">
                {creates.map((g) => (
                  <div key={g.title} className="py-1">
                    <p className="px-4 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>
                    {g.items.map((i) => (
                      <Link key={i.path} href={`${base}/${i.path}`} onClick={close} className="flex items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-surface-2 hover:text-navy">
                        {i.label}
                        {i.shortcut && <kbd className="rounded border border-border px-1.5 font-mono text-[10px] text-muted">{i.shortcut}</kbd>}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Dropdown>
        )}

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("marine:search"))}
          className="flex h-9 w-9 items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-sm text-muted transition hover:border-brand/40 hover:text-navy sm:w-64 sm:justify-start sm:px-3"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="ml-auto hidden rounded border border-border bg-surface px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
        </button>

        <Dropdown
          label="Notifications"
          width="w-80"
          button={
            <span className="relative">
              <Bell className="size-5" aria-hidden />
              {notices.length > 0 && (
                <span
                  className={`absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${urgent ? "bg-danger" : "bg-brand"}`}
                >
                  {notices.length}
                </span>
              )}
            </span>
          }
        >
          {(close) => (
            <div>
              <p className="border-b border-border px-4 py-3 text-sm font-semibold text-navy">Needs attention</p>
              {notices.length === 0 ? (
                <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
                  <Check className="size-4 text-success" aria-hidden /> All clear. Nothing needs attention.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {notices.map((n) => (
                    <li key={n.href + n.label}>
                      <Link href={n.href} onClick={close} className="flex gap-3 px-4 py-3 hover:bg-surface-2">
                        <span
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${n.tone === "red" ? "bg-danger" : n.tone === "amber" ? "bg-amber-500" : "bg-brand"}`}
                          aria-hidden
                        />
                        <span>
                          <span className="block text-sm font-medium text-navy">{n.label}</span>
                          <span className="block text-xs text-muted">{n.detail}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Dropdown>

        {companies.length > 1 && (
          <Dropdown
            label="Switch company"
            width="w-64"
            button={
              <>
                <span className="hidden text-sm font-medium text-navy sm:inline">{company.name}</span>
                <ChevronDown className="size-4" aria-hidden />
              </>
            }
          >
            {(close) => (
              <div className="py-1.5">
                <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Company</p>
                {companies.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/c/${c.slug}/dashboard`}
                    onClick={close}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2"
                  >
                    <span className="flex h-8 w-12 items-center justify-center rounded-md border border-border bg-white p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element -- logos are served as-is (AVIF) */}
                      <img src={c.logo} alt="" className="max-h-6 w-auto object-contain" />
                    </span>
                    <span className="flex-1 font-medium text-navy">{c.name}</span>
                    {c.slug === company.slug && <Check className="size-4 text-brand" aria-hidden />}
                  </Link>
                ))}
              </div>
            )}
          </Dropdown>
        )}

        <Dropdown
          label="Account"
          width="w-64"
          button={
            <span className="flex size-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{initials}</span>
          }
        >
          {(close) => (
            <div>
              <div className="border-b border-border px-4 py-3">
                <p className="truncate text-sm font-semibold text-navy">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
                <p className="mt-1 text-xs font-medium text-brand">{user.roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  close();
                  window.dispatchEvent(new Event("marine:shortcuts"));
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-surface-2"
              >
                <Keyboard className="size-4" aria-hidden /> Keyboard shortcuts
              </button>
              <form action={logout}>
                <button type="submit" className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm text-danger hover:bg-red-50">
                  <LogOut className="size-4" aria-hidden /> Sign out
                </button>
              </form>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
