import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getSite } from "@/lib/data/website";
import { isCompanySlug } from "@/lib/permissions";
import { SiteHeader } from "./site-header";
import { ElicheChrome } from "./_eliche/chrome";
import { ACCENT, siteContext, whatsappLink } from "./site";

export async function generateMetadata({ params }: LayoutProps<"/site/[company]">): Promise<Metadata> {
  const { company } = await params;
  if (!isCompanySlug(company)) return {};
  const site = await getSite(company);
  return {
    title: { default: site.seoTitle, template: `%s · ${site.name}` },
    description: site.seoDescription,
    openGraph: { title: site.seoTitle, description: site.seoDescription, siteName: site.name, type: "website" },
    icons: { icon: company === "eliche-radice" ? "/icons/favicon-48.png" : site.logo },
  };
}

async function Shell({ params, children }: { params: Promise<{ company: string }>; children: React.ReactNode }) {
  const { site, base, visible, preview } = await siteContext(params);
  const colors = ACCENT[site.slug];
  const style = { "--site-accent": colors.accent, "--site-accent-soft": colors.accentSoft, "--site-dark": colors.dark, "--site-darker": colors.darker } as React.CSSProperties;

  if (!visible) {
    return (
      <div style={style} className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logo} alt={site.name} className="h-14 w-auto" />
        <h1 className="mt-8 text-3xl font-semibold text-[var(--site-dark)]">Our new website is coming soon</h1>
        <p className="mt-3 max-w-md text-slate-600">{site.tagline}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          {site.phone && (
            <a href={`tel:${site.phone}`} className="rounded-full border border-slate-300 px-4 py-2 text-slate-800">
              {site.phone}
            </a>
          )}
          {site.email && (
            <a href={`mailto:${site.email}`} className="rounded-full border border-slate-300 px-4 py-2 text-slate-800">
              {site.email}
            </a>
          )}
        </div>
      </div>
    );
  }

  if (site.slug === "eliche-radice") {
    return (
      <ElicheChrome site={site} base={base} preview={preview}>
        {children}
      </ElicheChrome>
    );
  }

  const links = [
    { href: base || "/", label: "Home" },
    { href: `${base}/about`, label: "About" },
    { href: `${base}/services`, label: "Services" },
    ...(site.showCatalogue && site.listings.length ? [{ href: `${base}/catalogue`, label: "Catalogue" }] : []),
    ...(site.showGallery && site.gallery.some((g) => g.published) ? [{ href: `${base}/gallery`, label: "Gallery" }] : []),
    { href: `${base}/contact`, label: "Contact" },
  ];
  const cta = site.showBooking ? { href: `${base}/book`, label: "Book a service" } : { href: `${base}/contact`, label: "Get a quote" };
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, `);

  return (
    <div style={style} className="flex min-h-screen flex-col bg-white text-slate-800 antialiased">
      {preview && (
        <div className="bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Preview: this website isn&apos;t published yet. Visitors see &ldquo;coming soon&rdquo;. Publish it from Marketing → Website.
        </div>
      )}
      <div className="hidden bg-[var(--site-darker)] text-[13px] text-slate-300 md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-2">
          <span className="font-medium uppercase tracking-[0.2em] text-white/70">{site.tagline}</span>
          <span className="flex items-center gap-6">
            {site.openingHours[0] && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden /> {site.openingHours[0]}
              </span>
            )}
            {site.phone && (
              <a href={`tel:${site.phone}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="size-3.5" aria-hidden /> {site.phone}
              </a>
            )}
            {site.email && (
              <a href={`mailto:${site.email}`} className="flex items-center gap-1.5 hover:text-white">
                <Mail className="size-3.5" aria-hidden /> {site.email}
              </a>
            )}
          </span>
        </div>
      </div>
      <SiteHeader base={base} logo={site.logo} name={site.name} links={links} cta={cta} />
      <main className="flex-1">{children}</main>

      <footer className="bg-[var(--site-darker)] text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="inline-flex rounded-xl bg-white px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={site.logo} alt={site.name} className="h-9 w-auto" />
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">{site.heroText}</p>
            <div className="mt-5 flex gap-3 text-sm">
              {[
                ["Facebook", site.facebook],
                ["Instagram", site.instagram],
                ["LinkedIn", site.linkedin],
              ]
                .filter(([, url]) => url)
                .map(([label, url]) => (
                  <a key={label} href={url!} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-3 py-1.5 hover:border-white/40 hover:text-white">
                    {label}
                  </a>
                ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Explore</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
              {site.showBooking && (
                <li>
                  <Link href={`${base}/book`} className="hover:text-white">
                    Book a service
                  </Link>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Contact</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {site.phone && (
                <li className="flex gap-2">
                  <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <a href={`tel:${site.phone}`} className="hover:text-white">
                    {site.phone}
                  </a>
                </li>
              )}
              {site.email && (
                <li className="flex gap-2">
                  <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <a href={`mailto:${site.email}`} className="break-all hover:text-white">
                    {site.email}
                  </a>
                </li>
              )}
              {site.address && (
                <li className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="whitespace-pre-line">{site.address}</span>
                </li>
              )}
              {site.openingHours.length > 0 && (
                <li className="flex gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{site.openingHours.join(" · ")}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-500 sm:px-6">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
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

export default function SiteLayout({ params, children }: LayoutProps<"/site/[company]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}
