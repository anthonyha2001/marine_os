"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, Hammer, Home, Menu, MessageCircle, Receipt, Sailboat, ShieldCheck, UserRound, X } from "lucide-react";

const ITEMS = [
  { path: "", label: "Home", icon: Home },
  { path: "/boats", label: "My boats", icon: Sailboat },
  { path: "/work", label: "Work", icon: Hammer },
  { path: "/invoices", label: "Invoices", icon: Receipt },
  { path: "/messages", label: "Messages", icon: MessageCircle },
  { path: "/offers", label: "Offers", icon: FileText },
  { path: "/appointments", label: "Appointments", icon: CalendarDays },
  { path: "/warranties", label: "Warranties", icon: ShieldCheck },
  { path: "/profile", label: "My details", icon: UserRound },
] as const;
const PHONE_BAR = 4; // the first four on the phone's bottom bar, the rest under "More"

/** Portal menu: tabs on a computer, a bottom bar on a phone. */
export function PortalNav({ token, name, unread }: { token: string; name: string; unread: number }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const base = `/p/${token}`;
  const active = (path: string) => (path ? pathname.startsWith(base + path) : pathname === base);
  const badge = (path: string) =>
    path === "/messages" && unread > 0 ? (
      <span className="ml-1 rounded-full bg-danger px-1.5 text-[10px] font-semibold leading-4 text-white">{unread}</span>
    ) : null;

  return (
    <>
      {/* Computer: tabs under the header */}
      <nav aria-label="My portal" className="sticky top-0 z-20 hidden border-b border-border bg-surface/95 backdrop-blur md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
          <span className="mr-3 shrink-0 py-3 text-sm font-semibold text-navy">{name}</span>
          {ITEMS.map((i) => (
            <Link
              key={i.path}
              href={base + i.path}
              aria-current={active(i.path) ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition ${
                active(i.path) ? "border-brand text-navy" : "border-transparent text-muted hover:text-navy"
              }`}
            >
              <i.icon className="size-4" aria-hidden /> {i.label}
              {badge(i.path)}
            </Link>
          ))}
        </div>
      </nav>

      {/* Phone: bottom bar */}
      <nav aria-label="My portal" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {ITEMS.slice(0, PHONE_BAR).map((i) => (
            <Link
              key={i.path}
              href={base + i.path}
              aria-current={active(i.path) ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(i.path) ? "text-brand" : "text-muted"}`}
            >
              <i.icon className="size-5" aria-hidden />
              {i.label}
            </Link>
          ))}
          <button type="button" onClick={() => setMore(true)} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${ITEMS.slice(PHONE_BAR).some((i) => active(i.path)) ? "text-brand" : "text-muted"}`}>
            <Menu className="size-5" aria-hidden />
            More
            {unread > 0 && <span className="absolute right-4 top-1.5 size-2 rounded-full bg-danger" aria-label={`${unread} unread messages`} />}
          </button>
        </div>
      </nav>
      {more && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-label="More">
          <div className="absolute inset-0 bg-navy-deep/40" onClick={() => setMore(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-2xl">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-sm font-semibold text-navy">{name}</span>
              <button type="button" onClick={() => setMore(false)} aria-label="Close" className="rounded-lg p-1.5 text-muted">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {ITEMS.slice(PHONE_BAR).map((i) => (
              <Link key={i.path} href={base + i.path} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-navy hover:bg-surface-2">
                <i.icon className="size-5 text-brand" aria-hidden /> {i.label}
                {badge(i.path)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
