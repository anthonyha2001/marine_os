import Link from "next/link";
import { Cormorant, DM_Serif_Display, Jost, Manrope, Marcellus, Playfair_Display } from "next/font/google";
import { Clock, Mail, MapPin, MessageCircle, Phone, UserRound } from "lucide-react";
import type { SiteData } from "@/lib/data/website";
import { CORNER_RADIUS } from "@/lib/website-theme";
import { whatsappLink } from "../site";
import { MobileMenu, ScrollHeader } from "./motion";

// The fonts a company can choose in Design. Each is only downloaded when the site uses it.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--er-f-playfair", display: "swap" });
const cormorant = Cormorant({ subsets: ["latin"], variable: "--er-f-cormorant", display: "swap" });
const marcellus = Marcellus({ subsets: ["latin"], weight: "400", variable: "--er-f-marcellus", display: "swap" });
const dmserif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--er-f-dmserif", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--er-f-manrope", display: "swap" });
const jost = Jost({ subsets: ["latin"], variable: "--er-f-jost", display: "swap" });
const FONT_VARS = [playfair, cormorant, marcellus, dmserif, manrope, jost].map((f) => f.variable).join(" ");
const HEADING = { playfair: "var(--er-f-playfair)", cormorant: "var(--er-f-cormorant)", marcellus: "var(--er-f-marcellus)", dmserif: "var(--er-f-dmserif)" } as const;
const BODY = { inter: "var(--font-inter)", manrope: "var(--er-f-manrope)", jost: "var(--er-f-jost)" } as const;

/** The Eliche Radice website frame: theme, glass header, footer with waves, WhatsApp. */
export function ErChrome({ site, base, preview, children }: { site: SiteData; base: string; preview: boolean; children: React.ReactNode }) {
  const t = site.theme;
  const nav = site.pages.filter((p) => p.inNav && p.published && p.slug !== "");
  const link = (slug: string) => `${base}/${slug}`.replace(/\/$/, "") || "/";
  const account = `${base}/account`;
  const book = `${base}/book`;
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, `);
  const social = (
    [
      ["Instagram", site.instagram],
      ["Facebook", site.facebook],
      ["LinkedIn", site.linkedin],
    ] as [string, string | null][]
  ).filter(([, url]) => url);
  const style = {
    "--er-navy": t.navy,
    "--er-gold": t.gold,
    "--er-cream": t.cream,
    "--er-ink": t.ink,
    "--er-heading": HEADING[t.headingFont],
    "--er-body": BODY[t.bodyFont],
    "--er-radius": CORNER_RADIUS[t.corners],
    // the website forms (shared with the other site) follow the theme
    "--site-accent": t.gold,
    "--site-accent-soft": `color-mix(in srgb, ${t.gold} 18%, white)`,
    "--site-dark": t.navy,
    "--site-darker": t.navy,
  } as React.CSSProperties;

  return (
    <div className={`er-site ${FONT_VARS} flex min-h-screen flex-col bg-[var(--er-cream)] font-[family-name:var(--er-body)] text-[var(--er-ink)] antialiased`} data-motion={t.motion} data-buttons={t.buttons} style={style}>
      {preview && (
        <div className="fixed inset-x-0 bottom-0 z-[70] bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Preview: visitors see “coming soon” until you publish it in Marketing → Website.
        </div>
      )}

      <ScrollHeader solid={t.header === "solid"}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href={base || "/"} className="flex shrink-0 items-center gap-3" aria-label={`${site.name}, home`}>
            <span className="flex size-11 items-center justify-center rounded-full bg-white/95 p-1.5 shadow-lg shadow-black/20 ring-1 ring-[var(--er-gold)]/40 transition group-data-[scrolled]/header:size-10">
              {/* eslint-disable-next-line @next/next/no-img-element -- the logo is served as-is */}
              <img src={site.logo} alt="" className="max-h-full w-auto" />
            </span>
            <span className="hidden font-[family-name:var(--er-heading)] text-xl tracking-wide text-white sm:block">{site.name}</span>
          </Link>
          <nav aria-label="Website" className="hidden items-center gap-1 lg:flex">
            {nav.map((p) => (
              <Link key={p.slug} href={link(p.slug)} className="group relative px-3 py-2 text-sm font-medium text-white/80 transition hover:text-white">
                {p.title}
                <span className="absolute inset-x-3 -bottom-0.5 h-px origin-left scale-x-0 bg-white/60 transition-transform duration-300 group-hover:scale-x-100" aria-hidden />
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={account} className="hidden items-center gap-2 rounded-[var(--er-radius)] border border-white/25 px-4 py-2.5 text-sm font-medium text-white transition hover:border-[var(--er-gold)] hover:text-[var(--er-gold)] sm:flex">
              <UserRound className="size-4" aria-hidden /> My account
            </Link>
            <Link href={book} className="hidden rounded-[var(--er-radius)] bg-[var(--er-gold)] px-5 py-2.5 text-sm font-semibold text-[var(--er-navy)] transition hover:brightness-95 sm:block">
              Book
            </Link>
            <MobileMenu links={[{ href: base || "/", label: "Home" }, ...nav.map((p) => ({ href: link(p.slug), label: p.title }))]} account={account} book={book} />
          </div>
        </div>
      </ScrollHeader>

      <main className="flex-1">{children}</main>

      <footer className="bg-[var(--er-navy)] text-white/65">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-10 pt-16 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-full bg-white p-2 ring-1 ring-[var(--er-gold)]/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={site.logo} alt="" className="max-h-full w-auto" />
              </span>
              <span className="font-[family-name:var(--er-heading)] text-2xl text-white">{site.name}</span>
            </div>
            <p className="mt-5 max-w-sm leading-relaxed">{site.tagline}</p>
            {social.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {social.map(([label, url]) => (
                  <a key={label} href={url!} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-4 py-1.5 text-sm transition hover:border-[var(--er-gold)] hover:text-[var(--er-gold)]">
                    {label}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Explore</p>
            <ul className="mt-5 space-y-2.5">
              {nav.map((p) => (
                <li key={p.slug}>
                  <Link href={link(p.slug)} className="transition hover:text-white">
                    {p.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={account} className="transition hover:text-white">
                  My account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Contact</p>
            <ul className="mt-5 space-y-3 text-sm">
              {site.phone && (
                <li className="flex gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-[var(--er-gold)]" aria-hidden />
                  <a href={`tel:${site.phone}`} className="hover:text-white">
                    {site.phone}
                  </a>
                </li>
              )}
              {site.email && (
                <li className="flex gap-2.5">
                  <Mail className="mt-0.5 size-4 shrink-0 text-[var(--er-gold)]" aria-hidden />
                  <a href={`mailto:${site.email}`} className="break-all hover:text-white">
                    {site.email}
                  </a>
                </li>
              )}
              {site.address && (
                <li className="flex gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--er-gold)]" aria-hidden />
                  <span className="whitespace-pre-line">{site.address}</span>
                </li>
              )}
              {site.openingHours.length > 0 && (
                <li className="flex gap-2.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-[var(--er-gold)]" aria-hidden />
                  <span>{site.openingHours.join(" · ")}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
        <p className="border-t border-white/10 px-5 py-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} {site.name}
        </p>
      </footer>

      {wa && (
        <a href={wa} target="_blank" rel="noopener" aria-label="Chat on WhatsApp" className="fixed bottom-6 right-6 z-40 flex size-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg shadow-black/20 transition hover:brightness-95">
          <MessageCircle className="size-6" aria-hidden />
        </a>
      )}
    </div>
  );
}
