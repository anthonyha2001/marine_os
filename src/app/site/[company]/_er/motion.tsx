"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/** A number that counts up when it scrolls into view. */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || el.closest('[data-motion="off"]')) {
      setShown(value);
      return;
    }
    let frame = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1800);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}

/** Header that turns into frosted glass once the page scrolls. */
export function ScrollHeader({ children, solid }: { children: React.ReactNode; solid: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const glass = scrolled || solid;
  return (
    <header
      data-scrolled={glass ? "" : undefined}
      className={`group/header fixed inset-x-0 top-0 z-50 transition-all duration-500 ${glass ? "border-b border-white/10 bg-[color-mix(in_srgb,var(--er-navy)_82%,transparent)] py-2 shadow-[0_10px_40px_-20px_rgb(0_0_0/0.6)] backdrop-blur-xl" : "py-4"}`}
    >
      {children}
    </header>
  );
}

/** Gallery photos that open full screen, with arrows and Esc. */
export function Lightbox({ items }: { items: { src: string; title: string; caption: string | null }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % items.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + items.length) % items.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items.length]);
  const current = open === null ? null : items[open];
  return (
    <>
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
        {items.map((g, i) => (
          <button
            key={g.src}
            type="button"
            onClick={() => setOpen(i)}
            className="er-reveal group relative block w-full overflow-hidden rounded-[var(--er-radius)] text-left"
            style={{ "--er-delay": `${(i % 3) * 90}ms` } as React.CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- photos served by /site-media */}
            <img src={g.src} alt={g.title} loading="lazy" className="w-full transition duration-500 group-hover:opacity-90" />
            <span className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/75 to-transparent p-4 pt-12 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              <span className="block font-[family-name:var(--er-heading)] text-lg text-white">{g.title}</span>
              {g.caption && <span className="block text-sm text-white/75">{g.caption}</span>}
            </span>
          </button>
        ))}
      </div>
      {current && (
        <div role="dialog" aria-label={current.title} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur" onClick={() => setOpen(null)}>
          <button type="button" aria-label="Close" className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => setOpen(null)}>
            <X className="size-6" />
          </button>
          <button type="button" aria-label="Previous" className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-6" onClick={(e) => (e.stopPropagation(), setOpen((i) => (i === null ? i : (i - 1 + items.length) % items.length)))}>
            <ChevronLeft className="size-7" />
          </button>
          <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.src} alt={current.title} className="max-h-[80vh] w-auto rounded-xl" />
            <figcaption className="mt-3 text-center text-white">
              <span className="font-[family-name:var(--er-heading)] text-xl">{current.title}</span>
              {current.caption && <span className="block text-sm text-white/70">{current.caption}</span>}
            </figcaption>
          </figure>
          <button type="button" aria-label="Next" className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-6" onClick={(e) => (e.stopPropagation(), setOpen((i) => (i === null ? i : (i + 1) % items.length)))}>
            <ChevronRight className="size-7" />
          </button>
        </div>
      )}
    </>
  );
}

/** Mobile menu: full-screen navy sheet. */
export function MobileMenu({ links, account, book }: { links: { href: string; label: string }[]; account: string; book: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [at, setAt] = useState(pathname);
  if (at !== pathname) {
    setAt(pathname);
    setOpen(false);
  }
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-label="Open the menu" className="flex size-11 flex-col items-center justify-center gap-1.5 rounded-full border border-white/20 text-white">
        <span className="h-0.5 w-5 bg-current" />
        <span className="h-0.5 w-5 bg-current" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--er-navy)] px-6 py-6 text-white" role="dialog" aria-label="Menu">
          <button type="button" onClick={() => setOpen(false)} aria-label="Close the menu" className="ml-auto rounded-full border border-white/20 p-2.5">
            <X className="size-5" />
          </button>
          <nav className="mt-8 flex flex-1 flex-col gap-2">
            {links.map((l, i) => (
              <a key={l.href} href={l.href} className="er-reveal font-[family-name:var(--er-heading)] text-4xl" data-shown="" style={{ "--er-delay": `${i * 60}ms` } as React.CSSProperties}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="grid gap-3">
            <a href={book} className="rounded-[var(--er-radius)] bg-[var(--er-gold)] px-6 py-4 text-center font-semibold text-[var(--er-navy)]">
              Book an appointment
            </a>
            <a href={account} className="rounded-[var(--er-radius)] border border-white/25 px-6 py-4 text-center font-semibold">
              My account
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
