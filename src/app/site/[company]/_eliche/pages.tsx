import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { mediaUrl, type SiteData } from "@/lib/data/website";
import { Picture } from "../blocks";
import { BookingForm, ContactForm } from "../forms";
import { whatsappLink } from "../site";

// Eliche Radice: an elegant, boutique look. Serif display type, cream and bronze, generous space,
// numbered sections, and the products shown large like a shop window.

type P = { site: SiteData; base: string };
const serif = "font-[family-name:var(--font-display)]";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.35em] text-[#a8692a]">
      {children}
    </p>
  );
}

function Title({
  children,
  center = false,
  as: As = "h2",
}: {
  children: React.ReactNode;
  center?: boolean;
  as?: "h1" | "h2";
}) {
  return (
    <As
      className={`${serif} mt-3 text-3xl leading-tight text-[#141b2d] sm:text-5xl ${center ? "text-center" : ""}`}
    >
      {children}
    </As>
  );
}

function Rule({ center = false }: { center?: boolean }) {
  return (
    <span
      className={`mt-6 block h-px w-16 bg-[#a8692a] ${center ? "mx-auto" : ""}`}
      aria-hidden
    />
  );
}

/** Centred page opening used by the inner pages. */
function Opening({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title as="h1" center>
        {title}
      </Title>
      <Rule center />
      {text && (
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#5b4a36]">
          {text}
        </p>
      )}
    </section>
  );
}

function ShopGrid({
  base,
  products,
}: {
  base: string;
  products: SiteData["listings"];
}) {
  return (
    <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <Link
          key={p.productId}
          href={`${base}/catalogue/${p.code}`}
          className="group text-center"
        >
          <div className="overflow-hidden bg-white ring-1 ring-[#e9dccb]">
            <Picture
              id={p.imageId}
              url={p.imageUrl}
              alt={p.name}
              className="aspect-[4/5] w-full transition duration-700 group-hover:scale-105"
            />
          </div>
          {p.featured && (
            <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-[#a8692a]">
              Featured
            </p>
          )}
          <h3
            className={`${serif} ${p.featured ? "mt-1" : "mt-5"} text-xl text-[#141b2d]`}
          >
            {p.name}
          </h3>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#8a7a66]">
            Ref. {p.code}
          </p>
          <span className="mt-3 inline-block border-b border-[#a8692a] pb-0.5 text-[12px] uppercase tracking-[0.2em] text-[#a8692a]">
            Request a quote
          </span>
        </Link>
      ))}
    </div>
  );
}

function Invitation({ site, base }: P) {
  return (
    <section className="bg-[#141b2d] text-center text-white">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#d9a66a]">
          {site.name}
        </p>
        <h2
          className={`${serif} mt-4 text-3xl italic leading-snug sm:text-4xl`}
        >
          Every boat deserves the right propeller.
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {site.showBooking && (
            <Link
              href={`${base}/book`}
              className="bg-[#a8692a] px-8 py-3.5 text-[13px] uppercase tracking-[0.2em] text-white transition hover:bg-[#8a5520]"
            >
              Book an appointment
            </Link>
          )}
          <Link
            href={`${base}/contact`}
            className="border border-white/40 px-8 py-3.5 text-[13px] uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
          >
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ElicheHome({ site, base }: P) {
  const hero = mediaUrl(site.heroImageId);
  const services = site.services.filter((s) => s.published).slice(0, 4);
  const products = site.showCatalogue ? site.listings.slice(0, 6) : [];
  const gallery = site.showGallery
    ? site.gallery.filter((g) => g.published).slice(0, 8)
    : [];
  return (
    <>
      {/* Opening: text beside a large picture (or the propeller mark) */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div>
          <Eyebrow>{site.tagline}</Eyebrow>
          <h1
            className={`${serif} mt-5 text-4xl leading-[1.08] text-[#141b2d] sm:text-6xl`}
          >
            {site.heroTitle}
          </h1>
          <Rule />
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#5b4a36]">
            {site.heroText}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            {products.length > 0 && (
              <Link
                href={`${base}/catalogue`}
                className="bg-[#141b2d] px-8 py-3.5 text-[13px] uppercase tracking-[0.2em] text-white transition hover:bg-[#a8692a]"
              >
                Discover the shop
              </Link>
            )}
            {site.showBooking && (
              <Link
                href={`${base}/book`}
                className="border border-[#141b2d] px-8 py-3.5 text-[13px] uppercase tracking-[0.2em] text-[#141b2d] transition hover:border-[#a8692a] hover:text-[#a8692a]"
              >
                Book an appointment
              </Link>
            )}
          </div>
        </div>
        <div className="relative">
          <div
            className="absolute -inset-4 -z-0 translate-x-6 translate-y-6 bg-[#f2e7d8]"
            aria-hidden
          />
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt=""
              className="relative aspect-[4/5] w-full object-cover"
            />
          ) : (
            <div className="relative flex aspect-[4/5] items-center justify-center bg-white ring-1 ring-[#e9dccb]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/icon-512.png"
                alt=""
                className="w-2/3 opacity-90"
              />
            </div>
          )}
        </div>
      </section>

      {/* Three promises, numbered */}
      {site.highlights.length > 0 && (
        <section className="border-y border-[#e9dccb] bg-white/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-3 sm:px-6">
            {site.highlights.map((h, i) => (
              <div key={h.title}>
                <p className={`${serif} text-4xl text-[#a8692a]`}>
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-3 text-[13px] uppercase tracking-[0.2em] text-[#141b2d]">
                  {h.title}
                </p>
                {h.body && (
                  <p className="mt-2 leading-relaxed text-[#5b4a36]">
                    {h.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shop window */}
      {products.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="text-center">
            <Eyebrow>The shop</Eyebrow>
            <Title center>Selected for your boat</Title>
            <Rule center />
          </div>
          <div className="mt-14">
            <ShopGrid base={base} products={products} />
          </div>
          <div className="mt-14 text-center">
            <Link
              href={`${base}/catalogue`}
              className="border-b border-[#141b2d] pb-1 text-[13px] uppercase tracking-[0.2em] text-[#141b2d] hover:border-[#a8692a] hover:text-[#a8692a]"
            >
              View the whole shop
            </Link>
          </div>
        </section>
      )}

      {/* Our story, as a quote */}
      <section className="bg-[#f3ece2]">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
          <Eyebrow>Our story</Eyebrow>
          <p
            className={`${serif} mt-6 text-2xl italic leading-relaxed text-[#141b2d] sm:text-3xl`}
          >
            &ldquo;{site.aboutText.split(/\n\s*\n/)[0]}&rdquo;
          </p>
          <Link
            href={`${base}/about`}
            className="mt-10 inline-block border-b border-[#a8692a] pb-1 text-[13px] uppercase tracking-[0.2em] text-[#a8692a]"
          >
            Read our story
          </Link>
        </div>
      </section>

      {/* Services in alternating rows */}
      {services.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="text-center">
            <Eyebrow>Services</Eyebrow>
            <Title center>What we do</Title>
            <Rule center />
          </div>
          {services.some((s) => s.imageId) ? (
            <div className="mt-16 space-y-16">
              {services.map((s, i) => (
                <div
                  key={s.id}
                  className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}
                >
                  <Picture
                    id={s.imageId}
                    alt={s.title}
                    icon="service"
                    className="aspect-[3/2] w-full ring-1 ring-[#e9dccb]"
                  />
                  <div>
                    <p className={`${serif} text-5xl text-[#e3cdb0]`}>
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h3 className={`${serif} mt-2 text-3xl text-[#141b2d]`}>
                      {s.title}
                    </h3>
                    <p className="mt-4 text-lg leading-relaxed text-[#5b4a36]">
                      {s.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Without photos: a calm numbered list instead of empty picture frames.
            <div className="mt-16 grid gap-x-16 gap-y-12 md:grid-cols-2">
              {services.map((s, i) => (
                <div key={s.id} className="border-t border-[#e9dccb] pt-6">
                  <p className={`${serif} text-4xl text-[#e3cdb0]`}>
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className={`${serif} mt-2 text-2xl text-[#141b2d]`}>
                    {s.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-[#5b4a36]">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Gallery strip */}
      {gallery.length > 0 && (
        <section className="pb-24">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <Eyebrow>Gallery</Eyebrow>
            <Title center>From our workshop</Title>
            <Rule center />
          </div>
          <div className="mt-12 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:px-6">
            {gallery.map((g) => (
              <Link
                key={g.id}
                href={`${base}/gallery`}
                className="w-72 shrink-0 snap-start sm:w-80"
              >
                <Picture
                  id={g.imageId}
                  alt={g.title}
                  className="aspect-[3/4] w-full"
                />
                <p className={`${serif} mt-3 text-lg text-[#141b2d]`}>
                  {g.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Invitation site={site} base={base} />
    </>
  );
}

export function ElicheAbout({ site, base }: P) {
  const paragraphs = site.aboutText.split(/\n\s*\n/);
  return (
    <>
      <Opening eyebrow="Our story" title={site.aboutTitle} />
      {site.aboutImageId && (
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Picture
            id={site.aboutImageId}
            alt={site.aboutTitle}
            className="aspect-[16/7] w-full"
          />
        </div>
      )}
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className={`whitespace-pre-line leading-relaxed text-[#3d3427] ${i === 0 ? `${serif} text-2xl` : "mt-6 text-lg"}`}
          >
            {p}
          </p>
        ))}
      </section>
      {site.highlights.length > 0 && (
        <section className="border-t border-[#e9dccb]">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-3 sm:px-6">
            {site.highlights.map((h, i) => (
              <div key={h.title} className="text-center">
                <p className={`${serif} text-4xl text-[#a8692a]`}>
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-3 text-[13px] uppercase tracking-[0.2em] text-[#141b2d]">
                  {h.title}
                </p>
                {h.body && (
                  <p className="mt-2 leading-relaxed text-[#5b4a36]">
                    {h.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <Invitation site={site} base={base} />
    </>
  );
}

export function ElicheServices({ site, base }: P) {
  const services = site.services.filter((s) => s.published);
  return (
    <>
      <Opening eyebrow="Services" title="What we do" text={site.heroText} />
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="divide-y divide-[#e9dccb] border-y border-[#e9dccb]">
          {services.map((s, i) => (
            <div
              key={s.id}
              className="grid gap-6 py-10 sm:grid-cols-[6rem_1fr_16rem] sm:items-center"
            >
              <p className={`${serif} text-5xl text-[#e3cdb0]`}>
                {String(i + 1).padStart(2, "0")}
              </p>
              <div>
                <h2 className={`${serif} text-2xl text-[#141b2d]`}>
                  {s.title}
                </h2>
                <p className="mt-2 leading-relaxed text-[#5b4a36]">
                  {s.description}
                </p>
              </div>
              {s.imageId ? (
                <Picture
                  id={s.imageId}
                  alt={s.title}
                  className="aspect-[4/3] w-full"
                />
              ) : (
                <span className="hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </section>
      <Invitation site={site} base={base} />
    </>
  );
}

export function ElicheCatalogue({ site, base, q }: P & { q: string }) {
  const needle = q.trim().toLowerCase();
  const products = site.listings.filter(
    (p) =>
      !needle ||
      p.name.toLowerCase().includes(needle) ||
      p.code.includes(needle) ||
      (p.description ?? "").toLowerCase().includes(needle),
  );
  return (
    <>
      <Opening
        eyebrow="The shop"
        title="Our products"
        text="Prices on request: ask for a quote and we reply with price and availability."
      />
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <form className="relative mx-auto max-w-sm">
          <Search
            className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-[#8a7a66]"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search the shop"
            aria-label="Search the shop"
            className="w-full border-b border-[#c9b394] bg-transparent py-2 pl-7 text-center outline-none focus:border-[#a8692a]"
          />
        </form>
        <div className="mt-14">
          {products.length ? (
            <ShopGrid base={base} products={products} />
          ) : (
            <p className="text-center text-[#5b4a36]">
              {q
                ? "Nothing matches your search. Ask us: we can probably find it."
                : "Our shop is coming soon."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

export function ElicheProduct({
  site,
  base,
  product,
}: P & { product: SiteData["listings"][number] }) {
  const wa = whatsappLink(
    site.whatsapp,
    `Hello ${site.name}, I'd like a quote for ${product.name} (ref. ${product.code}).`,
  );
  const others = site.listings
    .filter((p) => p.productId !== product.productId)
    .slice(0, 3);
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div className="bg-white ring-1 ring-[#e9dccb]">
          <Picture
            id={product.imageId}
            url={product.imageUrl}
            alt={product.name}
            className="aspect-[4/5] w-full"
          />
        </div>
        <div className="lg:pt-8">
          <Link
            href={`${base}/catalogue`}
            className="text-[12px] uppercase tracking-[0.25em] text-[#8a7a66] hover:text-[#a8692a]"
          >
            ← The shop
          </Link>
          <h1
            className={`${serif} mt-6 text-4xl leading-tight text-[#141b2d] sm:text-5xl`}
          >
            {product.name}
          </h1>
          <p className="mt-3 text-xs uppercase tracking-[0.25em] text-[#8a7a66]">
            Ref. {product.code}
          </p>
          <Rule />
          {product.description && (
            <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-[#5b4a36]">
              {product.description}
            </p>
          )}
          <p className={`${serif} mt-8 text-xl italic text-[#141b2d]`}>
            Price on request
          </p>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener"
              className="mt-5 inline-flex items-center gap-2 bg-[#25d366] px-6 py-3 text-[13px] uppercase tracking-[0.15em] text-white"
            >
              <MessageCircle className="size-4" aria-hidden /> Ask on WhatsApp
            </a>
          )}
          <div className="mt-10 border-t border-[#e9dccb] pt-8">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#a8692a]">
              Request a quote
            </p>
            <div className="mt-5">
              <ContactForm
                slug={site.slug}
                product={{ id: product.productId, name: product.name }}
              />
            </div>
          </div>
        </div>
      </section>
      {others.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <p className="text-center text-[11px] uppercase tracking-[0.35em] text-[#a8692a]">
            You may also like
          </p>
          <div className="mt-10">
            <ShopGrid base={base} products={others} />
          </div>
        </section>
      )}
    </>
  );
}

export function ElicheGallery({ site, base }: P) {
  const items = site.gallery.filter((g) => g.published);
  return (
    <>
      <Opening eyebrow="Gallery" title="From our workshop" />
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((g, i) => (
            <figure key={g.id} className={i % 3 === 1 ? "lg:mt-16" : ""}>
              <Picture
                id={g.imageId}
                alt={g.title}
                className="aspect-[3/4] w-full"
              />
              <figcaption className="mt-4">
                <p className={`${serif} text-xl text-[#141b2d]`}>{g.title}</p>
                {g.caption && (
                  <p className="mt-1 text-sm leading-relaxed text-[#5b4a36]">
                    {g.caption}
                  </p>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <Invitation site={site} base={base} />
    </>
  );
}

export function ElicheBook({
  site,
  slots,
  minDate,
}: P & { slots: string[]; minDate: string }) {
  return (
    <>
      <Opening
        eyebrow="Appointments"
        title="Book an appointment"
        text="Tell us about your boat and choose a moment that suits you. We will call to confirm."
      />
      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <div className="bg-white p-6 ring-1 ring-[#e9dccb] sm:p-10">
          <BookingForm slug={site.slug} slots={slots} minDate={minDate} />
        </div>
        {site.phone && (
          <p className="mt-6 text-center text-[#5b4a36]">
            Prefer to call?{" "}
            <a
              href={`tel:${site.phone}`}
              className="text-[#a8692a] underline-offset-4 hover:underline"
            >
              {site.phone}
            </a>
          </p>
        )}
      </section>
    </>
  );
}

export function ElicheContact({ site }: P) {
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, `);
  return (
    <>
      <Opening eyebrow="Contact" title="We'd love to hear from you" />
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-8">
          {[
            ["Call", site.phone, site.phone ? `tel:${site.phone}` : null],
            ["WhatsApp", site.whatsapp, wa],
            ["Write", site.email, site.email ? `mailto:${site.email}` : null],
            ["Visit", site.address, null],
          ]
            .filter(([, value]) => value)
            .map(([label, value, href]) => (
              <div key={label}>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#a8692a]">
                  {label}
                </p>
                {href ? (
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener"
                    className={`${serif} mt-1 block break-words text-2xl text-[#141b2d] hover:text-[#a8692a]`}
                  >
                    {value}
                  </a>
                ) : (
                  <p
                    className={`${serif} mt-1 whitespace-pre-line text-2xl text-[#141b2d]`}
                  >
                    {value}
                  </p>
                )}
              </div>
            ))}
          {site.openingHours.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#a8692a]">
                Opening hours
              </p>
              {site.openingHours.map((h) => (
                <p key={h} className="mt-1 text-lg text-[#141b2d]">
                  {h}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white p-6 ring-1 ring-[#e9dccb] sm:p-10">
          <p className={`${serif} text-2xl text-[#141b2d]`}>Send a message</p>
          <div className="mt-6">
            <ContactForm slug={site.slug} />
          </div>
        </div>
      </section>
      {site.mapQuery && (
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <iframe
            title={`Map: ${site.name}`}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&output=embed`}
            loading="lazy"
            className="h-80 w-full grayscale-[40%] ring-1 ring-[#e9dccb]"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </section>
      )}
    </>
  );
}
