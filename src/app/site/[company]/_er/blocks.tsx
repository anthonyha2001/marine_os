import Link from "next/link";
import { Anchor, ArrowDown, ArrowRight, BellRing, CalendarCheck, Check, Clock, Mail, MapPin, MessageCircle, Phone, Quote, Sailboat, Smartphone, Users } from "lucide-react";
import { APPOINTMENT_SLOTS } from "@/lib/data/portal";
import type { SiteBlock, SiteData } from "@/lib/data/website";
import { businessToday } from "@/lib/dates";
import { BookingForm, ContactForm } from "../forms";
import { whatsappLink } from "../site";
import { CountUp, Lightbox } from "./motion";
import { Button, Heading, Section, Waves, img, list, resolveLink, videoSource } from "./parts";

type Ctx = { site: SiteData; base: string };
type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const delay = (i: number, step = 90) => ({ "--er-delay": `${i * step}ms` }) as React.CSSProperties;

/** Draws one block of a page. Blocks with nothing to show (e.g. no numbers yet) draw nothing. */
export function ErBlock({ block, ctx }: { block: SiteBlock; ctx: Ctx }) {
  const d = block.data;
  switch (block.type) {
    case "hero":
      return <Hero d={d} ctx={ctx} />;
    case "stats":
      return <Stats d={d} />;
    case "services":
      return <Services d={d} ctx={ctx} />;
    case "products":
      return <Products d={d} ctx={ctx} />;
    case "split":
      return <Split d={d} ctx={ctx} />;
    case "steps":
      return <Steps d={d} />;
    case "gallery":
      return <GalleryBlock d={d} ctx={ctx} />;
    case "testimonials":
      return <Testimonials d={d} />;
    case "faq":
      return <Faq d={d} />;
    case "portal":
      return <Portal d={d} ctx={ctx} />;
    case "charter":
      return <Charter d={d} ctx={ctx} />;
    case "cta":
      return <Cta d={d} ctx={ctx} />;
    case "contact":
      return <Contact d={d} ctx={ctx} />;
    case "booking":
      return <Booking d={d} ctx={ctx} />;
    case "text":
      return <TextBlock d={d} />;
    case "video":
      return <VideoBlock d={d} />;
    case "logos":
      return <Logos d={d} />;
    default:
      return null;
  }
}

function Hero({ d, ctx }: { d: Row; ctx: Ctx }) {
  const full = d.size === "full";
  const photo = img(d.image);
  const video = videoSource(d.video);
  return (
    <section className={`relative isolate flex items-center overflow-hidden bg-[var(--er-navy)] text-white ${full ? "min-h-[100svh]" : "min-h-[62vh] sm:min-h-[56vh]"}`}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- photos served by /site-media
        <img src={photo} alt="" className="absolute inset-0 -z-20 size-full scale-105 object-cover" />
      )}
      {video?.kind === "file" && <video src={video.src} poster={photo ?? undefined} autoPlay muted loop playsInline className="absolute inset-0 -z-20 size-full object-cover" />}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_20%,color-mix(in_srgb,var(--er-gold)_26%,transparent),transparent_55%),linear-gradient(180deg,color-mix(in_srgb,var(--er-navy)_55%,transparent),var(--er-navy)_92%)]" aria-hidden />
      <div className="er-caustics absolute inset-0 -z-10" aria-hidden />
      {Boolean(d.propeller) && (
        <div className="pointer-events-none absolute -right-40 top-1/2 -z-10 hidden size-[42rem] -translate-y-1/2 opacity-[0.07] lg:block" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ctx.site.logo} alt="" className="er-spin size-full object-contain [filter:brightness(0)_invert(1)]" />
        </div>
      )}
      <div className="mx-auto w-full max-w-7xl px-5 pb-28 pt-36 sm:px-8">
        {d.eyebrow ? (
          <p className="er-reveal flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.32em] text-[var(--er-gold)]" data-shown="">
            <span className="h-px w-10 bg-[var(--er-gold)]" aria-hidden /> {s(d.eyebrow)}
          </p>
        ) : null}
        <h1 className={`er-reveal mt-6 max-w-4xl whitespace-pre-line font-[family-name:var(--er-heading)] leading-[1.02] ${full ? "text-5xl sm:text-7xl lg:text-8xl" : "text-4xl sm:text-6xl"}`} data-shown="" style={delay(1, 120)}>
          {s(d.title)
            .split("\n")
            .map((line, i, all) => (
              <span key={i} className={`block ${i === all.length - 1 && all.length > 1 ? "er-shimmer" : ""}`}>
                {line}
              </span>
            ))}
        </h1>
        {d.text ? (
          <p className="er-reveal mt-7 max-w-2xl text-lg leading-relaxed text-white/75 sm:text-xl" data-shown="" style={delay(2, 120)}>
            {s(d.text)}
          </p>
        ) : null}
        {Boolean(d.primaryLabel || d.secondaryLabel) && (
          <div className="er-reveal mt-10 flex flex-wrap gap-3" data-shown="" style={delay(3, 120)}>
            <Button href={d.primaryLink} label={d.primaryLabel} base={ctx.base} />
            <Button href={d.secondaryLink} label={d.secondaryLabel} variant="secondary" base={ctx.base} />
          </div>
        )}
      </div>
      {full && (
        <a href="#content" className="absolute bottom-24 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/50 transition hover:text-white sm:flex">
          Scroll <ArrowDown className="er-float size-4" aria-hidden />
        </a>
      )}
      {Boolean(d.waves) && <Waves className="text-[var(--er-cream)]" />}
    </section>
  );
}

function Stats({ d }: { d: Row }) {
  const items = list<Row>(d.items).filter((i) => i.label);
  if (!items.length) return null;
  return (
    <Section tone={d.tone}>
      <div className={`grid gap-10 text-center sm:grid-cols-2 ${items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {items.map((i, n) => (
          <div key={n} className="er-reveal" style={delay(n)}>
            <p className="font-[family-name:var(--er-heading)] text-5xl text-[var(--er-gold)] sm:text-6xl">
              {typeof i.value === "number" ? <CountUp value={i.value} suffix={s(i.suffix)} /> : `${s(i.value)}${s(i.suffix)}`}
            </p>
            <p className="mt-3 text-sm uppercase tracking-[0.2em] opacity-75">{s(i.label)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Services({ d, ctx }: { d: Row; ctx: Ctx }) {
  const services = ctx.site.services.filter((x) => x.published);
  if (!services.length) return null;
  return (
    <Section tone={d.tone}>
      <Heading eyebrow={d.eyebrow} title={d.title} intro={d.intro} />
      {d.layout === "list" ? (
        <ol className="divide-y divide-current/10 border-y border-current/10">
          {services.map((x, i) => (
            <li key={x.id} className="er-reveal group grid gap-4 py-8 sm:grid-cols-[6rem_1fr_2fr] sm:items-baseline" style={delay(i, 70)}>
              <span className="font-[family-name:var(--er-heading)] text-4xl text-[var(--er-gold)]/60 transition group-hover:text-[var(--er-gold)]">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-[family-name:var(--er-heading)] text-2xl text-[var(--er-navy)] group-data-[tone=dark]/section:text-white">{x.title}</h3>
              <p className="leading-relaxed opacity-80">{x.description}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((x, i) => {
            const photo = img(x.imageId);
            return (
              <article key={x.id} data-spot data-tilt className="er-reveal er-light group relative flex flex-col overflow-hidden rounded-[var(--er-radius)] bg-white shadow-[0_20px_60px_-30px_rgb(10_25_41/0.35)] ring-1 ring-black/5 transition-[transform,box-shadow] duration-300 hover:shadow-[0_30px_80px_-30px_rgb(10_25_41/0.5)]" style={delay(i)}>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-105" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-[var(--er-navy)]">
                    <span className="font-[family-name:var(--er-heading)] text-6xl text-[var(--er-gold)]/80">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-[family-name:var(--er-heading)] text-xl text-[var(--er-navy)]">{x.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--er-ink)]/75">{x.description}</p>
                  <span className="mt-4 h-px w-10 bg-[var(--er-gold)] transition-all duration-500 group-hover:w-full" aria-hidden />
                </div>
              </article>
            );
          })}
        </div>
      )}
      {d.buttonLabel ? (
        <div className="er-reveal mt-12">
          <Button href={d.buttonLink} label={d.buttonLabel} variant="secondary" base={ctx.base} />
        </div>
      ) : null}
    </Section>
  );
}

function Products({ d, ctx }: { d: Row; ctx: Ctx }) {
  let products = ctx.site.listings;
  if (d.featuredOnly) products = products.filter((p) => p.featured);
  const count = Number(d.count) || 0;
  if (count > 0) products = products.slice(0, count);
  if (!products.length) return null;
  return (
    <Section tone={d.tone}>
      <Heading eyebrow={d.eyebrow} title={d.title} intro={d.intro} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => {
          const photo = img(p.imageId) ?? p.imageUrl;
          return (
            <Link key={p.productId} href={`${ctx.base}/catalogue/${p.code}`} data-spot className="er-reveal er-light group relative block overflow-hidden rounded-[var(--er-radius)] bg-white ring-1 ring-black/5 transition duration-500 hover:-translate-y-1 hover:shadow-[0_30px_70px_-35px_rgb(10_25_41/0.55)]" style={delay(i % 3)}>
              <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-[var(--er-cream)] to-white">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={p.name} loading="lazy" className="size-full object-contain p-8 transition duration-700 group-hover:scale-110 group-hover:rotate-2" />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    <Anchor className="size-14 text-[var(--er-gold)]/40" aria-hidden />
                  </span>
                )}
                {p.featured && <span className="absolute left-4 top-4 rounded-full bg-[var(--er-navy)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--er-gold)]">Featured</span>}
              </div>
              <div className="flex items-end justify-between gap-3 p-6">
                <span>
                  <span className="block text-[11px] uppercase tracking-[0.2em] text-[var(--er-ink)]/50">Ref. {p.code}</span>
                  <span className="mt-1 block font-[family-name:var(--er-heading)] text-xl text-[var(--er-navy)]">{p.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--er-gold)]">
                  Quote <ArrowRight className="size-3.5 transition group-hover:translate-x-1" aria-hidden />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      {d.buttonLabel ? (
        <div className="er-reveal mt-12 text-center">
          <Button href={d.buttonLink} label={d.buttonLabel} base={ctx.base} />
        </div>
      ) : null}
    </Section>
  );
}

function Split({ d, ctx }: { d: Row; ctx: Ctx }) {
  const photo = img(d.image);
  const points = list<Row>(d.points).filter((p) => p.text);
  if (!d.title && !d.text && !photo) return null;
  return (
    <Section tone={d.tone}>
      <div className={`grid items-center gap-14 lg:grid-cols-2 ${d.side === "left" ? "" : "lg:[&>*:first-child]:order-2"}`}>
        <div className="er-reveal relative">
          <div className="absolute -inset-4 -z-10 rounded-[calc(var(--er-radius)*1.5)] bg-[var(--er-gold)]/15 blur-2xl" aria-hidden />
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="aspect-[4/5] w-full rounded-[var(--er-radius)] object-cover shadow-[0_40px_90px_-40px_rgb(10_25_41/0.6)]" />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center rounded-[var(--er-radius)] bg-[var(--er-navy)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ctx.site.logo} alt="" className="er-spin w-1/2 opacity-30 [filter:brightness(0)_invert(1)]" />
            </div>
          )}
          <span className="absolute -bottom-5 -right-5 hidden size-24 rounded-full border border-[var(--er-gold)]/50 lg:block" aria-hidden />
        </div>
        <div>
          <Heading eyebrow={d.eyebrow} title={d.title} />
          {d.text ? (
            <div className="er-reveal -mt-6 space-y-4 text-lg leading-relaxed opacity-85">
              {s(d.text)
                .split(/\n\s*\n/)
                .map((p, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {p}
                  </p>
                ))}
            </div>
          ) : null}
          {points.length > 0 && (
            <ul className="mt-8 space-y-3">
              {points.map((p, i) => (
                <li key={i} className="er-reveal flex gap-3" style={delay(i, 80)}>
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--er-gold)] text-[var(--er-navy)]">
                    <Check className="size-3" aria-hidden />
                  </span>
                  {s(p.text)}
                </li>
              ))}
            </ul>
          )}
          {d.buttonLabel ? (
            <div className="er-reveal mt-10">
              <Button href={d.buttonLink} label={d.buttonLabel} base={ctx.base} />
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function Steps({ d }: { d: Row }) {
  const items = list<Row>(d.items).filter((i) => i.title);
  if (!items.length) return null;
  return (
    <Section tone={d.tone}>
      <Heading eyebrow={d.eyebrow} title={d.title} intro={d.intro} center />
      <ol className="relative grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <span className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-[var(--er-gold)]/60 to-transparent lg:block" aria-hidden />
        {items.map((i, n) => (
          <li key={n} className="er-reveal relative text-center" style={delay(n, 120)}>
            <span className="relative mx-auto flex size-14 items-center justify-center rounded-full border border-[var(--er-gold)] bg-[var(--er-navy)] font-[family-name:var(--er-heading)] text-xl text-[var(--er-gold)] shadow-[0_0_30px_-5px_var(--er-gold)]">{n + 1}</span>
            <h3 className="mt-6 font-[family-name:var(--er-heading)] text-xl text-[var(--er-navy)] group-data-[tone=dark]/section:text-white">{s(i.title)}</h3>
            {i.text ? <p className="mt-2 text-sm leading-relaxed opacity-75">{s(i.text)}</p> : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function GalleryBlock({ d, ctx }: { d: Row; ctx: Ctx }) {
  let items = ctx.site.gallery.filter((g) => g.published && g.imageId);
  const count = Number(d.count) || 0;
  if (count > 0) items = items.slice(0, count);
  if (!items.length) return null;
  return (
    <Section tone={d.tone}>
      <Heading eyebrow={d.eyebrow} title={d.title} intro={d.intro} />
      <Lightbox items={items.map((g) => ({ src: img(g.imageId)!, title: g.title, caption: g.caption }))} />
      {d.buttonLabel ? (
        <div className="er-reveal mt-12 text-center">
          <Button href={d.buttonLink} label={d.buttonLabel} variant="secondary" base={ctx.base} />
        </div>
      ) : null}
    </Section>
  );
}

function Testimonials({ d }: { d: Row }) {
  const items = list<Row>(d.items).filter((i) => i.quote);
  if (!items.length) return null;
  return (
    <Section tone={d.tone}>
      <Heading eyebrow={d.eyebrow} title={d.title} center />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((i, n) => (
          <figure key={n} data-spot className="er-reveal er-light relative rounded-[var(--er-radius)] bg-white p-8 text-[var(--er-ink)] shadow-[0_20px_60px_-35px_rgb(10_25_41/0.45)] ring-1 ring-black/5" style={delay(n % 3)}>
            <Quote className="size-8 text-[var(--er-gold)]" aria-hidden />
            <blockquote className="mt-4 font-[family-name:var(--er-heading)] text-lg leading-relaxed text-[var(--er-navy)]">“{s(i.quote)}”</blockquote>
            <figcaption className="mt-6 text-sm">
              <span className="font-semibold text-[var(--er-navy)]">{s(i.name)}</span>
              {i.boat ? <span className="block text-[var(--er-ink)]/60">{s(i.boat)}</span> : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

function Faq({ d }: { d: Row }) {
  const items = list<Row>(d.items).filter((i) => i.q);
  if (!items.length) return null;
  return (
    <Section tone={d.tone}>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <Heading eyebrow={d.eyebrow} title={d.title || "Questions"} />
        <div className="divide-y divide-current/10 border-y border-current/10">
          {items.map((i, n) => (
            <details key={n} className="er-reveal group py-5" style={delay(n, 60)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-[family-name:var(--er-heading)] text-xl text-[var(--er-navy)] group-data-[tone=dark]/section:text-white">
                {s(i.q)}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--er-gold)] text-[var(--er-gold)] transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 whitespace-pre-line leading-relaxed opacity-80">{s(i.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Portal({ d, ctx }: { d: Row; ctx: Ctx }) {
  const items = list<Row>(d.items).filter((i) => i.title);
  const icons = [Sailboat, BellRing, CalendarCheck, MessageCircle, Smartphone, Users];
  const photo = img(d.image);
  return (
    <section data-tone="dark" className="group/section relative isolate overflow-hidden bg-[var(--er-navy)] text-white">
      <div className="er-caustics absolute inset-0 -z-10" aria-hidden />
      <div className="absolute -left-40 top-0 -z-10 size-[36rem] rounded-full bg-[var(--er-gold)]/15 blur-3xl" aria-hidden />
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 py-24 sm:px-8 lg:grid-cols-2">
        <div>
          <Heading eyebrow={d.eyebrow} title={d.title} intro={d.text} />
          <div className="er-reveal -mt-4 flex flex-wrap gap-3">
            <Button href="/account" label="Open my account" base={ctx.base} />
            <Button href="/account#new" label="Create my account" variant="secondary" base={ctx.base} />
          </div>
        </div>
        <div className="relative">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="er-reveal mb-6 aspect-video w-full rounded-[var(--er-radius)] object-cover" />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((i, n) => {
              const Icon = icons[n % icons.length];
              return (
                <div key={n} data-spot className="er-reveal er-light rounded-[var(--er-radius)] border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition hover:border-[var(--er-gold)]/50" style={delay(n)}>
                  <Icon className="size-6 text-[var(--er-gold)]" aria-hidden />
                  <p className="mt-4 font-[family-name:var(--er-heading)] text-lg text-white">{s(i.title)}</p>
                  {i.text ? <p className="mt-1 text-sm text-white/65">{s(i.text)}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Charter({ d, ctx }: { d: Row; ctx: Ctx }) {
  const yachts = list<Row>(d.items).filter((i) => i.name);
  const photo = img(d.image);
  return (
    <section id="charter" data-tone="dark" className="group/section relative isolate overflow-hidden bg-[var(--er-navy)] text-white">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="absolute inset-0 -z-20 size-full object-cover opacity-40" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--er-navy)]/40 via-[var(--er-navy)]/80 to-[var(--er-navy)]" aria-hidden />
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Heading eyebrow={d.eyebrow} title={d.title} intro={d.intro} />
          {d.status ? (
            <span className="er-reveal mb-12 inline-flex items-center gap-2 rounded-full border border-[var(--er-gold)]/60 bg-[var(--er-gold)]/10 px-5 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--er-gold)]">
              <span className="size-2 animate-pulse rounded-full bg-[var(--er-gold)]" aria-hidden /> {s(d.status)}
            </span>
          ) : null}
        </div>
        {yachts.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {yachts.map((y, n) => {
              const yp = img(y.image);
              return (
                <article key={n} data-spot data-tilt className="er-reveal er-light group overflow-hidden rounded-[var(--er-radius)] border border-white/10 bg-white/[0.04] backdrop-blur transition-[transform] duration-300" style={delay(n)}>
                  <div className="relative aspect-[16/10] overflow-hidden bg-white/5">
                    {yp ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={yp} alt={s(y.name)} className="size-full object-cover transition duration-700 group-hover:scale-105" />
                    ) : (
                      <Sailboat className="absolute inset-0 m-auto size-14 text-[var(--er-gold)]/40" aria-hidden />
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="font-[family-name:var(--er-heading)] text-2xl text-white">{s(y.name)}</h3>
                    <p className="mt-2 flex gap-4 text-xs uppercase tracking-[0.18em] text-[var(--er-gold)]">
                      {y.length ? <span>{s(y.length)}</span> : null}
                      {y.guests ? <span>{s(y.guests)} guests</span> : null}
                    </p>
                    {y.text ? <p className="mt-3 text-sm leading-relaxed text-white/70">{s(y.text)}</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="er-reveal mx-auto mt-14 max-w-2xl rounded-[var(--er-radius)] border border-white/10 bg-white p-6 text-[var(--er-ink)] sm:p-8">
          <p className="font-[family-name:var(--er-heading)] text-2xl text-[var(--er-navy)]">{s(d.buttonLabel) || "Join the waiting list"}</p>
          <p className="mt-1 text-sm text-[var(--er-ink)]/70">Leave your details and we&apos;ll tell you first when bookings open.</p>
          <div className="mt-6">
            <ContactForm slug={ctx.site.slug} message="Please add me to the yacht charter waiting list." sentTitle="You're on the list" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Cta({ d, ctx }: { d: Row; ctx: Ctx }) {
  if (!d.title) return null;
  const photo = img(d.image);
  return (
    <section className="relative isolate overflow-hidden bg-[var(--er-navy)] text-white">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="absolute inset-0 -z-20 size-full object-cover opacity-35" />
      )}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_120%,color-mix(in_srgb,var(--er-gold)_35%,transparent),transparent_60%)]" aria-hidden />
      <div className="er-caustics absolute inset-0 -z-10" aria-hidden />
      <div className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8 sm:py-32">
        <h2 className="er-reveal font-[family-name:var(--er-heading)] text-4xl leading-tight sm:text-6xl">{s(d.title)}</h2>
        {d.text ? <p className="er-reveal mx-auto mt-5 max-w-2xl text-lg text-white/75">{s(d.text)}</p> : null}
        <div className="er-reveal mt-10 flex flex-wrap justify-center gap-3">
          <Button href={d.primaryLink} label={d.primaryLabel} base={ctx.base} />
          <Button href={d.secondaryLink} label={d.secondaryLabel} variant="secondary" base={ctx.base} />
        </div>
      </div>
    </section>
  );
}

function Contact({ d, ctx }: { d: Row; ctx: Ctx }) {
  const { site } = ctx;
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, `);
  const lines = (
    [
      [Phone, site.phone, site.phone ? `tel:${site.phone}` : null],
      [MessageCircle, site.whatsapp ? "WhatsApp" : null, wa],
      [Mail, site.email, site.email ? `mailto:${site.email}` : null],
      [MapPin, site.address, null],
      [Clock, site.openingHours.join(" · ") || null, null],
    ] as [typeof Phone, string | null, string | null][]
  ).filter(([, v]) => v);
  return (
    <Section tone="light">
      <Heading eyebrow={d.eyebrow} title={d.title} />
      <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          {lines.map(([Icon, value, href], n) => {
            const body = (
              <>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--er-navy)] text-[var(--er-gold)]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="whitespace-pre-line text-[var(--er-navy)]">{value}</span>
              </>
            );
            return href ? (
              <a key={n} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener" className="er-reveal flex items-center gap-4 rounded-[var(--er-radius)] bg-white p-4 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-[var(--er-gold)]" style={delay(n, 70)}>
                {body}
              </a>
            ) : (
              <div key={n} className="er-reveal flex items-center gap-4 rounded-[var(--er-radius)] bg-white p-4 ring-1 ring-black/5" style={delay(n, 70)}>
                {body}
              </div>
            );
          })}
          {Boolean(d.showMap) && site.mapQuery && (
            <iframe
              title="Map"
              loading="lazy"
              src={`https://www.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&output=embed`}
              className="er-reveal aspect-video w-full rounded-[var(--er-radius)] border-0 grayscale-[30%]"
            />
          )}
        </div>
        {Boolean(d.showForm) && (
          <div className="er-reveal rounded-[var(--er-radius)] bg-white p-6 shadow-[0_30px_70px_-40px_rgb(10_25_41/0.5)] ring-1 ring-black/5 sm:p-8">
            <p className="font-[family-name:var(--er-heading)] text-2xl text-[var(--er-navy)]">Send us a message</p>
            <p className="mb-6 mt-1 text-sm text-[var(--er-ink)]/65">
              Already a customer?{" "}
              <Link href={resolveLink("/account", ctx.base)} className="font-medium text-[var(--er-gold)] underline-offset-4 hover:underline">
                Write from your account
              </Link>{" "}
              and follow the answer there.
            </p>
            <ContactForm slug={site.slug} />
          </div>
        )}
      </div>
    </Section>
  );
}

function Booking({ d, ctx }: { d: Row; ctx: Ctx }) {
  const today = businessToday();
  const tomorrow = new Date(new Date(`${today}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
  return (
    <Section tone="light">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <Heading eyebrow={d.eyebrow} title={d.title} intro={d.text} />
          <div className="er-reveal -mt-4 rounded-[var(--er-radius)] bg-[var(--er-navy)] p-6 text-white">
            <p className="font-[family-name:var(--er-heading)] text-xl">Already a customer?</p>
            <p className="mt-1 text-sm text-white/70">Book from your account: pick your boat, then follow the work live in your app.</p>
            <div className="mt-5">
              <Button href="/account" label="Open my account" base={ctx.base} />
            </div>
          </div>
        </div>
        <div className="er-reveal rounded-[var(--er-radius)] bg-white p-6 shadow-[0_30px_70px_-40px_rgb(10_25_41/0.5)] ring-1 ring-black/5 sm:p-8">
          <BookingForm slug={ctx.site.slug} slots={APPOINTMENT_SLOTS} minDate={tomorrow} />
        </div>
      </div>
    </Section>
  );
}

function TextBlock({ d }: { d: Row }) {
  if (!d.title && !d.text) return null;
  const center = d.align === "center";
  return (
    <Section tone={d.tone}>
      <div className={`max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
        <Heading eyebrow={d.eyebrow} title={d.title} center={center} />
        <div className="er-reveal -mt-4 space-y-5 text-lg leading-relaxed opacity-85">
          {s(d.text)
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
        </div>
      </div>
    </Section>
  );
}

function VideoBlock({ d }: { d: Row }) {
  const v = videoSource(d.url);
  if (!v) return null;
  return (
    <Section tone={d.tone}>
      <Heading eyebrow={d.eyebrow} title={d.title} center />
      <div className="er-reveal relative mx-auto max-w-5xl overflow-hidden rounded-[var(--er-radius)] shadow-[0_40px_100px_-40px_rgb(0_0_0/0.7)] ring-1 ring-white/10">
        {v.kind === "embed" ? (
          <iframe src={v.src} title={s(d.title) || "Video"} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="aspect-video w-full border-0" />
        ) : (
          <video src={v.src} controls playsInline className="aspect-video w-full bg-black" />
        )}
      </div>
    </Section>
  );
}

function Logos({ d }: { d: Row }) {
  const items = list<Row>(d.items).filter((i) => img(i.image));
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <section className={`overflow-hidden py-14 ${d.tone === "dark" ? "bg-[var(--er-navy)]" : d.tone === "light" ? "bg-[var(--er-cream)]" : "bg-white"}`}>
      {d.title ? <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.3em] text-[var(--er-gold)]">{s(d.title)}</p> : null}
      <div className="relative [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
        <div className="er-marquee flex w-max items-center gap-16 pr-16">
          {row.map((i, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={n} src={img(i.image)!} alt={s(i.name)} className="h-12 w-auto opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0" />
          ))}
        </div>
      </div>
    </section>
  );
}
