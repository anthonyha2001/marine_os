import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { MessageCircle } from "lucide-react";
import type { SiteData } from "@/lib/data/website";
import { whatsappLink } from "../site";
import { ElicheHeader } from "./header";

export const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display", style: ["normal", "italic"] });

/** Eliche Radice website frame: warm cream, serif headings, centred logo, light footer. */
export function ElicheChrome({ site, base, preview, children }: { site: SiteData; base: string; preview: boolean; children: React.ReactNode }) {
  const links = [
    { href: base || "/", label: "Home" },
    { href: `${base}/about`, label: "Our story" },
    { href: `${base}/services`, label: "Services" },
    ...(site.showCatalogue && site.listings.length ? [{ href: `${base}/catalogue`, label: "Shop" }] : []),
    ...(site.showGallery && site.gallery.some((g) => g.published) ? [{ href: `${base}/gallery`, label: "Gallery" }] : []),
    { href: `${base}/contact`, label: "Contact" },
  ];
  const cta = site.showBooking ? { href: `${base}/book`, label: "Book" } : null;
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, `);
  const social = [
    ["Facebook", site.facebook],
    ["Instagram", site.instagram],
    ["LinkedIn", site.linkedin],
  ].filter(([, url]) => url) as [string, string][];

  return (
    <div
      className={`${display.variable} flex min-h-screen flex-col bg-[#faf6f0] text-[#2a2f3d] antialiased`}
      style={{ "--site-accent": "#a8692a", "--site-accent-soft": "#f2e7d8", "--site-dark": "#141b2d", "--site-darker": "#0c1120" } as React.CSSProperties}
    >
      {preview && (
        <div className="bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Preview: this website isn&apos;t published yet. Visitors see &ldquo;coming soon&rdquo;. Publish it from Marketing → Website.
        </div>
      )}
      <ElicheHeader base={base} logo={site.logo} name={site.name} tagline={site.tagline} links={links} cta={cta} />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#e9dccb] bg-[#f3ece2]">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={site.logo} alt={site.name} className="mx-auto h-12 w-auto" />
          <p className="mx-auto mt-5 max-w-lg font-[family-name:var(--font-display)] text-lg italic text-[#5b4a36]">{site.tagline}</p>
          <nav className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[12px] uppercase tracking-[0.25em] text-[#141b2d]" aria-label="Footer">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-[#a8692a]">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mx-auto mt-10 grid max-w-3xl gap-6 text-sm text-[#5b4a36] sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#a8692a]">Call</p>
              {site.phone ? (
                <a href={`tel:${site.phone}`} className="mt-1 block hover:text-[#141b2d]">
                  {site.phone}
                </a>
              ) : (
                <p className="mt-1">—</p>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#a8692a]">Write</p>
              {site.email ? (
                <a href={`mailto:${site.email}`} className="mt-1 block break-all hover:text-[#141b2d]">
                  {site.email}
                </a>
              ) : (
                <p className="mt-1">—</p>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#a8692a]">Visit</p>
              <p className="mt-1 whitespace-pre-line">{site.address ?? "—"}</p>
            </div>
          </div>
          {social.length > 0 && (
            <div className="mt-8 flex justify-center gap-6 text-[12px] uppercase tracking-[0.25em]">
              {social.map(([label, url]) => (
                <a key={label} href={url} target="_blank" rel="noopener" className="text-[#141b2d] hover:text-[#a8692a]">
                  {label}
                </a>
              ))}
            </div>
          )}
          <p className="mt-12 text-xs text-[#8a7a66]">
            © {new Date().getFullYear()} {site.name}
          </p>
        </div>
      </footer>

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener"
          aria-label="Chat on WhatsApp"
          className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-xl shadow-black/20 transition hover:scale-105"
        >
          <MessageCircle className="size-7" aria-hidden />
        </a>
      )}
    </div>
  );
}
