import { Suspense } from "react";
import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHero } from "../blocks";
import { ContactForm } from "../forms";
import { siteContext, whatsappLink } from "../site";
import { ErPage } from "../_er/render";

export const metadata: Metadata = { title: "Contact" };

async function Contact({ params }: { params: Promise<{ company: string }> }) {
  const { site, base, visible } = await siteContext(params);
  if (!visible) return null;
  if (site.slug === "eliche-radice") return <ErPage site={site} base={base} slug="contact" />;
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, `);
  const rows = [
    site.phone && { icon: Phone, label: "Phone", value: site.phone, href: `tel:${site.phone}` },
    wa && { icon: MessageCircle, label: "WhatsApp", value: site.whatsapp!, href: wa },
    site.email && { icon: Mail, label: "Email", value: site.email, href: `mailto:${site.email}` },
    site.address && { icon: MapPin, label: "Address", value: site.address, href: null },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href: string | null }[];

  return (
    <>
      <PageHero eyebrow="Contact" title="Get in touch" text="Questions, quotes or advice: send us a message and we'll answer quickly." />
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold text-[var(--site-dark)]">Send us a message</h2>
          <div className="mt-6">
            <ContactForm slug={site.slug} />
          </div>
        </div>
        <aside className="space-y-3">
          {rows.map((r) => {
            const body = (
              <>
                <r.icon className="mt-0.5 size-5 shrink-0 text-[var(--site-accent)]" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-500">{r.label}</span>
                  <span className="block whitespace-pre-line break-words font-semibold text-[var(--site-dark)]">{r.value}</span>
                </span>
              </>
            );
            return r.href ? (
              <a key={r.label} href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} rel="noopener" className="flex gap-3 rounded-2xl border border-slate-200 p-5 hover:border-[var(--site-accent)]">
                {body}
              </a>
            ) : (
              <div key={r.label} className="flex gap-3 rounded-2xl border border-slate-200 p-5">
                {body}
              </div>
            );
          })}
          {site.openingHours.length > 0 && (
            <div className="flex gap-3 rounded-2xl border border-slate-200 p-5">
              <Clock className="mt-0.5 size-5 shrink-0 text-[var(--site-accent)]" aria-hidden />
              <span>
                <span className="block text-sm text-slate-500">Opening hours</span>
                {site.openingHours.map((h) => (
                  <span key={h} className="block font-semibold text-[var(--site-dark)]">
                    {h}
                  </span>
                ))}
              </span>
            </div>
          )}
        </aside>
      </section>
      {site.mapQuery && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <iframe
            title={`Map: ${site.name}`}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&output=embed`}
            loading="lazy"
            className="h-80 w-full rounded-3xl border border-slate-200"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </section>
      )}
    </>
  );
}

export default function ContactPage({ params }: PageProps<"/site/[company]/contact">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Contact params={params} />
    </Suspense>
  );
}
