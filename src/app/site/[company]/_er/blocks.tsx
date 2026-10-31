import Link from "next/link";
import { Anchor, ArrowRight, BellRing, CalendarCheck, Check, Clock, Mail, MapPin, MessageCircle, Phone, Sailboat, Smartphone, Users } from "lucide-react";
import { APPOINTMENT_SLOTS } from "@/lib/data/portal";
import type { SiteBlock, SiteData } from "@/lib/data/website";
import { businessToday } from "@/lib/dates";
import { BookingForm, ContactForm } from "../forms";
import { whatsappLink } from "../site";
import { CountUp, Lightbox } from "./motion";
import { Button, Heading, Section, img, list, resolveLink, videoSource } from "./parts";

type Ctx = { site: SiteData; base: string };
type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const delay = (i: number, step = 70) => ({ "--er-delay": `${i * step}ms` }) as React.CSSProperties;
const card = "rounded-[var(--er-radius)] bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgb(10_25_41/0.04),0_8px_24px_-12px_rgb(10_25_41/0.12)]";

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
    <section className={`relative isolate flex items-end overflow-hidden bg-[var(--er-navy)] text-white ${full ? "min-h-[88svh]" : "min-h-[46vh]"}`}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- photos served by /site-media
        <img src={photo} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
      )}
      {video?.kind === "file" && <video src={video.src} poster={photo ?? undefined} autoPlay muted loop playsInline className="absolute inset-0 -z-20 size-full object-cover" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--er-navy)] via-[color-mix(in_srgb,var(--er-navy)_70%,transparent)] to-[color-mix(in_srgb,var(--er-navy)_35%,transparent)]" aria-hidden />
      <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${full ? "pb-20 pt-40 sm:pb-28" : "pb-14 pt-36"}`}>
        {d.eyebrow ? (
          <p className="er-reveal text-xs font-semibold uppercase tracking-[0.2em] text-[var(--er-gold)]" data-shown="">
            {s(d.eyebrow)}
          </p>
        ) : null}
        <h1 className={`er-reveal mt-4 max-w-3xl whitespace-pre-line font-[family-name:var(--er-heading)] leading-[1.08] ${full ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl"}`} data-shown="" style={delay(1)}>
          {s(d.title)}
        </h1>
        {d.text ? (
          <p className="er-reveal mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg" data-shown="" style={delay(2)}>
            {s(d.text)}
          </p>
        ) : null}
        {Boolean(d.primaryLabel || d.secondaryLabel) && (
          <div className="er-reveal mt-8 flex flex-wrap gap-3" data-shown="" style={delay(3)}>
            <Button href={d.primaryLink} label={d.primaryLabel} base={ctx.base} />
            <Button href={d.secondaryLink} label={d.secondaryLabel} variant="secondary" base={ctx.base} />
          </div>
        )}
      </div>
    </section>
  );
}

function Stats({ d }: { d: Row }) {
  const items = list<Row>(d.items).filter((i) => i.label);
  if (!items.length) return null;
  return (
    <Section tone={d.tone} className="[&>div]:py-14">
      <dl className={`grid gap-8 sm:grid-cols-2 ${items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {items.map((i, n) => (
          <div key={n} className="er-reveal flex flex-col-reverse text-center" style={delay(n)}>
            <dt className="mt-2 text-sm opacity-70">{s(i.label)}</dt>
            <dd className="font-[family-name:var(--er-heading)] text-4xl text-[var(--er-navy)] group-data-[tone=dark]/section:text-white sm:text-5xl">
              {typeof i.value === "number" ? <CountUp value={i.value} suffix={s(i.suffix)} /> : `${s(i.value)}${s(i.suffix)}`}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function Services({ d, ctx }: { d: Row; ctx: Ctx }) {
  const services = ctx.site.services.filter((x) => x.published);
  if (!services.length) return null;
  return (
    <Section tone={d.tone}>
      <div className="flex flex-wrap items-end justify-between gap-x-6">
        <Heading eyebrow={d.eyebrow} title={d.title} intro={d.intro} />
        {d.buttonLabel ? (
          <div className="er-reveal mb-12">
            <Button href={d.buttonLink} label={d.buttonLabel} variant="secondary" base={ctx.base} />
          </div>
        ) : null}
      </div>
      {d.layout === "list" ? (
        <ol className="divide-y divide-current/10 border-y border-current/10">
          {services.map((x, i) => (
            <li key={x.id} className="er-reveal grid gap-2 py-7 sm:grid-cols-[4rem_1fr_1.6fr] sm:items-baseline sm:gap-6" style={delay(i)}>
              <span className="text-sm font-semibold tabular-nums text-[var(--er-gold)]">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-[family-name:var(--er-heading)] text-xl text-[var(--er-navy)] group-data-[tone=dark]/section:text-white">{x.title}</h3>
              <p className="leading-relaxed opacity-75">{x.description}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((x, i) => {
            const photo = img(x.imageId);
            return (
              <article key={x.id} className={`er-reveal er-lift flex flex-col overflow-hidden ${card}`} style={delay(i)}>
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="aspect-[4/3] w-full object-cover" />
                )}
                <div className="flex flex-1 flex-col p-6">
                  {!photo && <span className="mb-5 text-sm font-semibold tabular-nums text-[var(--er-gold)]">{String(i + 1).padStart(2, "0")}</span>}
                  <h3 className="font-[family-name:var(--er-heading)] text-lg text-[var(--er-navy)]">{x.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--er-ink)]/70">{x.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
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
      <div className="flex flex-wrap items-end justify-between gap-x-6">
        <Heading eyebrow={d.eyebrow} title={d.title} intro={d.intro} />
        {d.buttonLabel ? (
          <div className="er-reveal mb-12">
            <Button href={d.buttonLink} label={d.buttonLabel} variant="secondary" base={ctx.base} />
          </div>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => {
          const photo = img(p.imageId) ?? p.imageUrl;
          return (
            <Link key={p.productId} href={`${ctx.base}/catalogue/${p.code}`} className={`er-reveal er-lift group block overflow-hidden ${card}`} style={delay(i % 3)}>
              <div className="relative aspect-[4/3] bg-[var(--er-cream)]">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={p.name} loading="lazy" className="size-full object-contain p-8" />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    <Anchor className="size-10 text-[var(--er-navy)]/15" aria-hidden />
                  </span>
                )}
                {p.featured && <span className="absolute left-4 top-4 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--er-navy)] ring-1 ring-black/5">Featured</span>}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] px-5 py-4">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[var(--er-navy)]">{p.name}</span>
                  <span className="block text-xs text-[var(--er-ink)]/50">Ref. {p.code}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--er-navy)]/70 transition group-hover:text-[var(--er-navy)]">
                  Request a quote <ArrowRight className="size-3.5" aria-hidden />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

function Split({ d, ctx }: { d: Row; ctx: Ctx }) {
  const photo = img(d.image);
  const points = list<Row>(d.points).filter((p) => p.text);
  if (!d.title && !d.text && !photo) return null;
  return (
    <Section tone={d.tone}>
      <div className={`grid items-center gap-12 lg:gap-16 ${photo ? "lg:grid-cols-2" : ""} ${d.side === "left" ? "" : "lg:[&>*:first-child]:order-2"}`}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="er-reveal aspect-[4/3] w-full rounded-[var(--er-radius)] object-cover lg:aspect-[4/5]" />
        )}
        <div className={photo ? "" : "max-w-3xl"}>
          <Heading eyebrow={d.eyebrow} title={d.title} />
          {d.text ? (
            <div className="er-reveal -mt-6 space-y-4 leading-relaxed opacity-80 sm:text-lg">
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
            <ul className="mt-7 space-y-3">
              {points.map((p, i) => (
                <li key={i} className="er-reveal flex gap-3" style={delay(i)}>
                  <Check className="mt-1 size-4 shrink-0 text-[var(--er-gold)]" aria-hidden />
                  {s(p.text)}
                </li>
              ))}
            </ul>
          )}
          {d.buttonLabel ? (
            <div className="er-reveal mt-9">
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
      <Heading eyebrow={d.eyebrow} title={d.title} intro={d.intro} />
      <ol className={`grid gap-8 sm:grid-cols-2 ${items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {items.map((i, n) => (
          <li key={n} className="er-reveal border-t border-current/15 pt-6" style={delay(n)}>
            <span className="text-sm font-semibold tabular-nums text-[var(--er-gold)]">Step {n + 1}</span>
            <h3 className="mt-2 font-[family-name:var(--er-heading)] text-xl text-[var(--er-navy)] group-data-[tone=dark]/section:text-white">{s(i.title)}</h3>
            {i.text ? <p className="mt-2 text-sm leading-relaxed opacity-70">{s(i.text)}</p> : null}
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
        <div className="er-reveal mt-10">
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
      <Heading eyebrow={d.eyebrow} title={d.title} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((i, n) => (
          <figure key={n} className={`er-reveal flex flex-col p-7 text-[var(--er-ink)] ${card}`} style={delay(n % 3)}>
            <blockquote className="flex-1 leading-relaxed text-[var(--er-navy)]">“{s(i.quote)}”</blockquote>
            <figcaption className="mt-6 border-t border-black/[0.06] pt-4 text-sm">
              <span className="font-semibold text-[var(--er-navy)]">{s(i.name)}</span>
              {i.boat ? <span className="block text-[var(--er-ink)]/55">{s(i.boat)}</span> : null}
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
      <div className="grid gap-10 lg:grid-cols-[1fr_1.7fr]">
        <Heading eyebrow={d.eyebrow} title={d.title || "Questions"} />
        <div className="divide-y divide-current/10 border-y border-current/10">
          {items.map((i, n) => (
            <details key={n} className="er-reveal group py-5" style={delay(n, 50)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-medium text-[var(--er-navy)] group-data-[tone=dark]/section:text-white">
                {s(i.q)}
                <span className="text-xl leading-none text-[var(--er-gold)] transition-transform duration-300 group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 whitespace-pre-line leading-relaxed opacity-75">{s(i.a)}</p>
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
    <Section tone="dark">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Heading eyebrow={d.eyebrow} title={d.title} intro={d.text} />
          <div className="er-reveal -mt-4 flex flex-wrap gap-3">
            <Button href="/account" label="Open my account" base={ctx.base} />
            <Button href="/account#new" label="Create my account" variant="secondary" base={ctx.base} />
          </div>
        </div>
        <div>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="er-reveal mb-5 aspect-video w-full rounded-[var(--er-radius)] object-cover" />
          )}
          <div className="grid gap-px overflow-hidden rounded-[var(--er-radius)] bg-white/10 sm:grid-cols-2">
            {items.map((i, n) => {
              const Icon = icons[n % icons.length];
              return (
                <div key={n} className="er-reveal bg-[var(--er-navy)] p-6" style={delay(n)}>
                  <Icon className="size-5 text-[var(--er-gold)]" aria-hidden />
                  <p className="mt-3 font-medium text-white">{s(i.title)}</p>
                  {i.text ? <p className="mt-1 text-sm text-white/60">{s(i.text)}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Section>
  );
}

function Charter({ d, ctx }: { d: Row; ctx: Ctx }) {
  const yachts = list<Row>(d.items).filter((i) => i.name);
  return (
    <Section tone="dark" id="charter">
      <div className="flex flex-wrap items-start justify-between gap-x-6">
        <Heading eyebrow={d.eyebrow} title={d.title} intro={d.intro} />
        {d.status ? <span className="er-reveal mb-10 rounded-full px-4 py-1.5 text-sm font-medium text-[var(--er-gold)] ring-1 ring-inset ring-[var(--er-gold)]/50">{s(d.status)}</span> : null}
      </div>
      {yachts.length > 0 && (
        <div className="mb-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {yachts.map((y, n) => {
            const yp = img(y.image);
            return (
              <article key={n} className="er-reveal overflow-hidden rounded-[var(--er-radius)] bg-white/[0.04] ring-1 ring-white/10" style={delay(n)}>
                <div className="relative aspect-[16/10] bg-white/5">
                  {yp ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={yp} alt={s(y.name)} className="size-full object-cover" />
                  ) : (
                    <Sailboat className="absolute inset-0 m-auto size-10 text-white/20" aria-hidden />
                  )}
                </div>
                <div className="p-6">
                  <h3 className="font-[family-name:var(--er-heading)] text-xl text-white">{s(y.name)}</h3>
                  <p className="mt-1 flex gap-4 text-sm text-white/55">
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
      <div className="er-reveal grid gap-8 rounded-[var(--er-radius)] bg-white p-6 text-[var(--er-ink)] sm:p-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="font-[family-name:var(--er-heading)] text-2xl text-[var(--er-navy)]">{s(d.buttonLabel) || "Join the waiting list"}</p>
          <p className="mt-2 text-sm text-[var(--er-ink)]/65">Leave your details and we&apos;ll tell you first when bookings open.</p>
        </div>
        <ContactForm slug={ctx.site.slug} message="Please add me to the yacht charter waiting list." sentTitle="You're on the list" />
      </div>
    </Section>
  );
}

function Cta({ d, ctx }: { d: Row; ctx: Ctx }) {
  if (!d.title) return null;
  const photo = img(d.image);
  return (
    <section className="relative isolate overflow-hidden bg-[var(--er-navy)] text-white">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="absolute inset-0 -z-20 size-full object-cover opacity-25" />
      )}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 px-5 py-16 sm:px-8 sm:py-20">
        <div className="er-reveal max-w-2xl">
          <h2 className="font-[family-name:var(--er-heading)] text-3xl leading-tight sm:text-4xl">{s(d.title)}</h2>
          {d.text ? <p className="mt-3 text-white/70">{s(d.text)}</p> : null}
        </div>
        <div className="er-reveal flex flex-wrap gap-3">
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
      [Phone, "Phone", site.phone, site.phone ? `tel:${site.phone}` : null],
      [MessageCircle, "WhatsApp", site.whatsapp, wa],
      [Mail, "Email", site.email, site.email ? `mailto:${site.email}` : null],
      [MapPin, "Address", site.address, null],
      [Clock, "Opening hours", site.openingHours.join("\n") || null, null],
    ] as [typeof Phone, string, string | null, string | null][]
  ).filter(([, , v]) => v);
  return (
    <Section tone="light">
      <Heading eyebrow={d.eyebrow} title={d.title} />
      <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <dl className="divide-y divide-black/[0.06] border-y border-black/[0.06]">
            {lines.map(([Icon, label, value, href], n) => (
              <div key={n} className="er-reveal flex gap-4 py-4" style={delay(n)}>
                <Icon className="mt-0.5 size-5 shrink-0 text-[var(--er-gold)]" aria-hidden />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-[var(--er-ink)]/50">{label}</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-[var(--er-navy)]">
                    {href ? (
                      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener" className="hover:underline">
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          {Boolean(d.showMap) && site.mapQuery && (
            <iframe title="Map" loading="lazy" src={`https://www.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&output=embed`} className="er-reveal mt-6 aspect-video w-full rounded-[var(--er-radius)] border-0" />
          )}
        </div>
        {Boolean(d.showForm) && (
          <div className={`er-reveal p-6 sm:p-8 ${card}`}>
            <p className="font-[family-name:var(--er-heading)] text-2xl text-[var(--er-navy)]">Send us a message</p>
            <p className="mb-6 mt-1 text-sm text-[var(--er-ink)]/65">
              Already a customer?{" "}
              <Link href={resolveLink("/account", ctx.base)} className="font-medium text-[var(--er-navy)] underline underline-offset-4">
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
            <p className="font-medium">Already a customer?</p>
            <p className="mt-1 text-sm text-white/65">Book from your account: pick your boat, then follow the work in your app.</p>
            <div className="mt-5">
              <Button href="/account" label="Open my account" base={ctx.base} />
            </div>
          </div>
        </div>
        <div className={`er-reveal p-6 sm:p-8 ${card}`}>
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
        <div className="er-reveal -mt-4 space-y-5 leading-relaxed opacity-80 sm:text-lg">
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
      <Heading eyebrow={d.eyebrow} title={d.title} />
      <div className="er-reveal overflow-hidden rounded-[var(--er-radius)] ring-1 ring-black/10">
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
    <section className={`overflow-hidden border-y border-black/[0.06] py-12 ${d.tone === "dark" ? "bg-[var(--er-navy)]" : d.tone === "light" ? "bg-[var(--er-cream)]" : "bg-white"}`}>
      {d.title ? <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--er-ink)]/50">{s(d.title)}</p> : null}
      <div className="relative [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
        <div className="er-marquee flex w-max items-center gap-16 pr-16">
          {row.map((i, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={n} src={img(i.image)!} alt={s(i.name)} className="h-10 w-auto opacity-50 grayscale" />
          ))}
        </div>
      </div>
    </section>
  );
}
