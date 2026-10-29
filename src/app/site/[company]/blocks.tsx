import Link from "next/link";
import { ArrowRight, CalendarCheck, Check, Package, Wrench } from "lucide-react";
import { mediaUrl, type SiteData } from "@/lib/data/website";

/** Page title band used on every inner page. */
export function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <section className="relative overflow-hidden bg-[var(--site-dark)] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--site-accent)_0%,transparent_55%)] opacity-30" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">{title}</h1>
        {text && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/80">{text}</p>}
      </div>
    </section>
  );
}

export function SectionTitle({ eyebrow, title, text, center = false }: { eyebrow?: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--site-accent)]">{eyebrow}</p>}
      <h2 className="mt-2 text-2xl font-semibold text-[var(--site-dark)] sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-lg leading-relaxed text-slate-600">{text}</p>}
    </div>
  );
}

/** Website picture, or a branded placeholder when there is none. */
export function Picture({ id, url, alt, className = "", icon = "product" }: { id?: string | null; url?: string | null; alt: string; className?: string; icon?: "product" | "service" }) {
  const src = mediaUrl(id) ?? url ?? null;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
  }
  const Icon = icon === "service" ? Wrench : Package;
  return (
    <div className={`flex items-center justify-center bg-[var(--site-accent-soft)] ${className}`} aria-hidden>
      <Icon className="size-10 text-[var(--site-accent)] opacity-70" />
    </div>
  );
}

export function ServiceGrid({ services }: { services: SiteData["services"] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <article key={s.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
          {s.imageId && <Picture id={s.imageId} alt={s.title} className="aspect-[16/9] w-full" icon="service" />}
          <div className="p-6">
            {!s.imageId && (
              <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--site-accent-soft)] text-[var(--site-accent)]">
                <Wrench className="size-5" aria-hidden />
              </span>
            )}
            <h3 className={`${s.imageId ? "" : "mt-4"} text-lg font-semibold text-[var(--site-dark)]`}>{s.title}</h3>
            <p className="mt-2 leading-relaxed text-slate-600">{s.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ProductGrid({ base, products }: { base: string; products: SiteData["listings"] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((p) => (
        <Link key={p.productId} href={`${base}/catalogue/${p.code}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
          <Picture id={p.imageId} url={p.imageUrl} alt={p.name} className="aspect-square w-full transition group-hover:scale-[1.02]" />
          <div className="p-4">
            {p.featured && <span className="mb-1 inline-block rounded-full bg-[var(--site-accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--site-accent)]">Featured</span>}
            <h3 className="font-semibold text-[var(--site-dark)]">{p.name}</h3>
            <p className="mt-1 text-xs text-slate-500">Ref. {p.code}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--site-accent)]">
              Ask for a quote <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function Highlights({ items }: { items: SiteData["highlights"] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {items.map((h) => (
        <li key={h.title} className="flex gap-3 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--site-accent)] text-white">
            <Check className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-white">{h.title}</p>
            {h.body && <p className="mt-1 text-sm leading-relaxed text-white/70">{h.body}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Closing call to action: book or get in touch. */
export function CtaBand({ base, site }: { base: string; site: SiteData }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-[var(--site-accent)] px-6 py-12 text-white sm:px-12">
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10" aria-hidden />
        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">{site.showBooking ? "Ready when your boat is" : "Let's talk about your project"}</h2>
            <p className="mt-2 max-w-xl text-white/85">
              {site.showBooking ? "Book a service in a minute. We confirm by phone." : "Tell us what you need and we'll send you a quote."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {site.showBooking && (
              <Link href={`${base}/book`} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-[var(--site-dark)] shadow-sm hover:bg-slate-100">
                <CalendarCheck className="size-5" aria-hidden /> Book a service
              </Link>
            )}
            <Link href={`${base}/contact`} className="inline-flex items-center gap-2 rounded-full border border-white/50 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
