"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

type NavLink = { href: string; label: string };

/** Eliche Radice: centred logo, small-caps menu underneath, bronze "Book" link. */
export function ElicheHeader({ base, logo, name, tagline, links, cta }: { base: string; logo: string; name: string; tagline: string; links: NavLink[]; cta: NavLink | null }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const home = base || "/";
  const active = (href: string) => (href === home ? path === home || path === `${home}/` : path.startsWith(href));
  return (
    <header className="sticky top-0 z-40 border-b border-[#e9dccb] bg-[#faf6f0]/95 backdrop-blur">
      <div className="hidden border-b border-[#e9dccb] py-1.5 text-center text-[11px] uppercase tracking-[0.35em] text-[#8a6a45] sm:block">{tagline}</div>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:flex-col lg:gap-4 lg:py-5">
        <Link href={home} aria-label={`${name} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={name} className="h-10 w-auto sm:h-12 lg:h-14" />
        </Link>
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`border-b pb-0.5 text-[13px] uppercase tracking-[0.2em] transition ${active(l.href) ? "border-[#a8692a] text-[#a8692a]" : "border-transparent text-[#141b2d] hover:text-[#a8692a]"}`}
            >
              {l.label}
            </Link>
          ))}
          {cta && (
            <Link href={cta.href} className="border border-[#a8692a] px-5 py-2 text-[13px] uppercase tracking-[0.2em] text-[#a8692a] transition hover:bg-[#a8692a] hover:text-white">
              {cta.label}
            </Link>
          )}
        </nav>
        <button type="button" onClick={() => setOpen((o) => !o)} className="p-2 text-[#141b2d] lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-[#e9dccb] px-4 pb-5 pt-2 text-center lg:hidden" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={`block py-3 text-sm uppercase tracking-[0.2em] ${active(l.href) ? "text-[#a8692a]" : "text-[#141b2d]"}`}>
              {l.label}
            </Link>
          ))}
          {cta && (
            <Link href={cta.href} onClick={() => setOpen(false)} className="mt-3 inline-block border border-[#a8692a] px-6 py-3 text-sm uppercase tracking-[0.2em] text-[#a8692a]">
              {cta.label}
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
