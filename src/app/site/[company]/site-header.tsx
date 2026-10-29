"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

type NavLink = { href: string; label: string };

/** Sticky header with the company logo; collapses into a menu on phones. */
export function SiteHeader({ base, logo, name, links, cta }: { base: string; logo: string; name: string; links: NavLink[]; cta: NavLink | null }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const home = base || "/";
  const active = (href: string) => (href === home ? path === home || path === `${home}/` : path.startsWith(href));
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6">
        <Link href={home} className="flex shrink-0 items-center" aria-label={`${name} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={name} className="h-9 w-auto sm:h-11" />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-[15px] font-medium transition ${active(l.href) ? "text-[var(--site-accent)]" : "text-slate-700 hover:text-[var(--site-dark)]"}`}
            >
              {l.label}
            </Link>
          ))}
          {cta && (
            <Link href={cta.href} className="ml-2 rounded-full bg-[var(--site-accent)] px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm transition hover:brightness-110">
              {cta.label}
            </Link>
          )}
        </nav>
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-slate-700 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 lg:hidden" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={`block rounded-lg px-3 py-3 text-base font-medium ${active(l.href) ? "text-[var(--site-accent)]" : "text-slate-800"}`}>
              {l.label}
            </Link>
          ))}
          {cta && (
            <Link href={cta.href} onClick={() => setOpen(false)} className="mt-2 block rounded-full bg-[var(--site-accent)] px-5 py-3 text-center font-semibold text-white">
              {cta.label}
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
