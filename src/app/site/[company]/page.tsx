import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Mail, MapPin, Phone } from "lucide-react";
import { mediaUrl } from "@/lib/data/website";
import { CtaBand, Highlights, Picture, ProductGrid, SectionTitle, ServiceGrid } from "./blocks";
import { siteContext } from "./site";
import { ElicheHome } from "./_eliche/pages";

async function Home({ params }: { params: Promise<{ company: string }> }) {
  const { site, base, visible } = await siteContext(params);
  if (!visible) return null;
  if (site.slug === "eliche-radice") return <ElicheHome site={site} base={base} />;
  const hero = mediaUrl(site.heroImageId);
  const services = site.services.filter((s) => s.published).slice(0, 6);
  const products = site.showCatalogue ? site.listings.slice(0, 8) : [];
  const gallery = site.showGallery ? site.gallery.filter((g) => g.published).slice(0, 6) : [];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-[var(--site-darker)] text-white">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-45" />
        ) : (
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_10%,var(--site-accent)_0%,transparent_50%),linear-gradient(180deg,var(--site-dark),var(--site-darker))] opacity-90" aria-hidden />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--site-darker)] via-[var(--site-darker)]/70 to-transparent" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
          <p className="inline-flex rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/85 backdrop-blur">{site.tagline}</p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">{site.heroTitle}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80 sm:text-xl">{site.heroText}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            {site.showBooking && (
              <Link href={`${base}/book`} className="inline-flex items-center gap-2 rounded-full bg-[var(--site-accent)] px-7 py-3.5 font-semibold text-white shadow-lg shadow-black/20 transition hover:brightness-110">
                <CalendarCheck className="size-5" aria-hidden /> Book a service
              </Link>
            )}
            <Link href={`${base}/services`} className="inline-flex items-center gap-2 rounded-full border border-white/30 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10">
              Our services <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Highlights */}
      {site.highlights.length > 0 && (
        <section className="bg-[var(--site-dark)]">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <Highlights items={site.highlights} />
          </div>
        </section>
      )}

      {/* Services */}
      {services.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle eyebrow="What we do" title="Services" />
            <Link href={`${base}/services`} className="inline-flex items-center gap-1 font-semibold text-[var(--site-accent)] hover:underline">
              All services <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-10">
            <ServiceGrid services={services} />
          </div>
        </section>
      )}

      {/* About */}
      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow="Who we are" title={site.aboutTitle} />
            <p className="mt-5 whitespace-pre-line text-lg leading-relaxed text-slate-600">{site.aboutText.split("\n\n")[0]}</p>
            <Link href={`${base}/about`} className="mt-6 inline-flex items-center gap-1 font-semibold text-[var(--site-accent)] hover:underline">
              More about us <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="overflow-hidden rounded-3xl shadow-xl shadow-slate-900/10">
            {site.aboutImageId ? (
              <Picture id={site.aboutImageId} alt={site.aboutTitle} className="aspect-[4/3] w-full" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-white p-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={site.logo} alt={site.name} className="max-h-32 w-auto" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured products */}
      {products.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle eyebrow="Catalogue" title="Products" text="Ask us for a quote on any product: we reply quickly with price and availability." />
            <Link href={`${base}/catalogue`} className="inline-flex items-center gap-1 font-semibold text-[var(--site-accent)] hover:underline">
              Full catalogue <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-10">
            <ProductGrid base={base} products={products} />
          </div>
        </section>
      )}

      {/* Gallery */}
      {gallery.length > 0 && (
        <section className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionTitle eyebrow="Our work" title="Projects" />
              <Link href={`${base}/gallery`} className="inline-flex items-center gap-1 font-semibold text-[var(--site-accent)] hover:underline">
                See the gallery <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
              {gallery.map((g) => (
                <figure key={g.id} className="overflow-hidden rounded-2xl">
                  <Picture id={g.imageId} alt={g.title} className="aspect-[4/3] w-full transition duration-500 hover:scale-105" />
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact strip */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {site.phone && (
            <a href={`tel:${site.phone}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 p-5 transition hover:border-[var(--site-accent)]">
              <Phone className="size-6 text-[var(--site-accent)]" aria-hidden />
              <span>
                <span className="block text-sm text-slate-500">Call us</span>
                <span className="font-semibold text-[var(--site-dark)]">{site.phone}</span>
              </span>
            </a>
          )}
          {site.email && (
            <a href={`mailto:${site.email}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 p-5 transition hover:border-[var(--site-accent)]">
              <Mail className="size-6 text-[var(--site-accent)]" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm text-slate-500">Email</span>
                <span className="block truncate font-semibold text-[var(--site-dark)]">{site.email}</span>
              </span>
            </a>
          )}
          {site.address && (
            <Link href={`${base}/contact`} className="flex items-center gap-4 rounded-2xl border border-slate-200 p-5 transition hover:border-[var(--site-accent)]">
              <MapPin className="size-6 text-[var(--site-accent)]" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm text-slate-500">Visit us</span>
                <span className="block truncate font-semibold text-[var(--site-dark)]">{site.address.split("\n")[0]}</span>
              </span>
            </Link>
          )}
        </div>
      </section>

      <CtaBand base={base} site={site} />
    </>
  );
}

export default function SiteHome({ params }: PageProps<"/site/[company]">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Home params={params} />
    </Suspense>
  );
}
