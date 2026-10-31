import Link from "next/link";
import { notFound } from "next/navigation";
import { Anchor, ArrowLeft, MessageCircle, ShieldCheck, Smartphone } from "lucide-react";
import { findPage, type SiteData } from "@/lib/data/website";
import { ContactForm } from "../forms";
import { whatsappLink } from "../site";
import { ErBlock } from "./blocks";
import { AccountForms } from "./account-forms";
import { Heading, Section, img } from "./parts";

type Ctx = { site: SiteData; base: string };

/** A page of the Eliche Radice site: its visible blocks, top to bottom. */
export function ErPage({ site, base, slug }: Ctx & { slug: string }) {
  const page = findPage(site, slug);
  if (!page) notFound();
  const blocks = page.blocks.filter((b) => !b.hidden);
  return (
    <>
      {blocks.map((b, i) => (
        <div key={b.id} id={i === 1 ? "content" : undefined}>
          <ErBlock block={b} ctx={{ site, base }} />
        </div>
      ))}
    </>
  );
}

function SmallHero({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <section className="bg-[var(--er-navy)] pb-14 pt-36 text-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--er-gold)]">{eyebrow}</p>
        <h1 className="mt-4 font-[family-name:var(--er-heading)] text-3xl sm:text-5xl">{title}</h1>
      </div>
    </section>
  );
}

/** One product: big photo, details, "Ask for a quote", and a few others. */
export function ErProduct({ site, base, product }: Ctx & { product: SiteData["listings"][number] }) {
  const photo = img(product.imageId) ?? product.imageUrl;
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, I'd like a quote for ${product.name} (ref. ${product.code}).`);
  const others = site.listings.filter((p) => p.productId !== product.productId).slice(0, 3);
  return (
    <>
      <SmallHero eyebrow={`Ref. ${product.code}`} title={product.name} />
      <Section tone="light">
        <Link href={`${base}/shop`} className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-[var(--er-navy)] hover:text-[var(--er-gold)]">
          <ArrowLeft className="size-4" aria-hidden /> Back to the shop
        </Link>
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="er-reveal relative overflow-hidden rounded-[var(--er-radius)] bg-white ring-1 ring-black/5" data-shown="">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={product.name} className="aspect-square w-full object-contain p-10" />
            ) : (
              <div className="flex aspect-square items-center justify-center">
                <Anchor className="size-20 text-[var(--er-gold)]/40" aria-hidden />
              </div>
            )}
          </div>
          <div>
            <h2 className="font-[family-name:var(--er-heading)] text-4xl text-[var(--er-navy)]">{product.name}</h2>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--er-ink)]/50">Reference {product.code}</p>
            {product.description && <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-[var(--er-ink)]/85">{product.description}</p>}
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-[var(--er-ink)]/70">
              <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 ring-1 ring-black/5">
                <ShieldCheck className="size-4 text-[var(--er-gold)]" aria-hidden /> Advice on the right size
              </span>
              <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 ring-1 ring-black/5">
                <Smartphone className="size-4 text-[var(--er-gold)]" aria-hidden /> Follow your order in the app
              </span>
            </div>
            <div className="mt-10 rounded-[var(--er-radius)] bg-white p-6 shadow-[0_30px_70px_-40px_rgb(10_25_41/0.5)] ring-1 ring-black/5 sm:p-8">
              <p className="font-[family-name:var(--er-heading)] text-2xl text-[var(--er-navy)]">Price on request</p>
              <p className="mb-6 mt-1 text-sm text-[var(--er-ink)]/65">Tell us about your boat and engine; we reply with the right size and a price.</p>
              <ContactForm slug={site.slug} product={{ id: product.productId, name: product.name }} />
              {wa && (
                <a href={wa} target="_blank" rel="noopener" className="mt-4 flex items-center justify-center gap-2 rounded-[var(--er-radius)] bg-[#25d366] px-6 py-3 text-sm font-semibold text-white">
                  <MessageCircle className="size-4" aria-hidden /> Or ask on WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </Section>
      {others.length > 0 && (
        <Section tone="white">
          <Heading eyebrow="The shop" title="You may also need" />
          <div className="grid gap-6 sm:grid-cols-3">
            {others.map((p) => {
              const ph = img(p.imageId) ?? p.imageUrl;
              return (
                <Link key={p.productId} href={`${base}/catalogue/${p.code}`} className="er-reveal group overflow-hidden rounded-[var(--er-radius)] bg-[var(--er-cream)] ring-1 ring-black/5 transition hover:-translate-y-1">
                  {ph ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ph} alt={p.name} className="aspect-square w-full object-contain p-8 transition duration-700 group-hover:scale-105" />
                  ) : (
                    <span className="flex aspect-square items-center justify-center">
                      <Anchor className="size-12 text-[var(--er-gold)]/40" aria-hidden />
                    </span>
                  )}
                  <span className="block p-5 font-[family-name:var(--er-heading)] text-lg text-[var(--er-navy)]">{p.name}</span>
                </Link>
              );
            })}
          </div>
        </Section>
      )}
    </>
  );
}

/** My account: sign in to the customer app, or create an account. */
export function ErAccount({ site }: Ctx) {
  return (
    <>
      <SmallHero eyebrow="Customer app" title="My account" />
      <Section tone="light">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div className="er-reveal" data-shown="">
            <h2 className="font-[family-name:var(--er-heading)] text-3xl text-[var(--er-navy)]">Your boat, in your pocket</h2>
            <ul className="mt-6 space-y-3 text-[var(--er-ink)]/80">
              {["Follow your work live: received, in progress, ready", "Your boats, engines and full service history", "Invoices, payments and statements", "Book appointments and message us", "Warranties and claims"].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--er-gold)]" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-[var(--er-ink)]/60">Once inside, add it to your phone&apos;s home screen: it works like an app.</p>
          </div>
          <AccountForms slug={site.slug} />
        </div>
      </Section>
    </>
  );
}
