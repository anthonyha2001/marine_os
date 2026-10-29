import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getSite } from "@/lib/data/website";
import { isCompanySlug } from "@/lib/permissions";
import { Picture, ProductGrid, SectionTitle } from "../../blocks";
import { ContactForm } from "../../forms";
import { siteContext, whatsappLink } from "../../site";
import { ElicheProduct } from "../../_eliche/pages";

export async function generateMetadata({ params }: PageProps<"/site/[company]/catalogue/[code]">): Promise<Metadata> {
  const { company, code } = await params;
  if (!isCompanySlug(company)) return {};
  const product = (await getSite(company)).listings.find((p) => p.code === code);
  return product ? { title: product.name, description: product.description ?? undefined } : {};
}

async function Product({ params }: { params: Promise<{ company: string; code: string }> }) {
  const [{ site, base, visible }, { code }] = await Promise.all([siteContext(params), params]);
  if (!visible) return null;
  const product = site.showCatalogue ? site.listings.find((p) => p.code === code) : undefined;
  if (!product) notFound();
  if (site.slug === "eliche-radice") return <ElicheProduct site={site} base={base} product={product} />;
  const others = site.listings.filter((p) => p.productId !== product.productId).slice(0, 4);
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, I'd like a quote for ${product.name} (ref. ${product.code}).`);
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Link href={`${base}/catalogue`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-[var(--site-accent)]">
          <ArrowLeft className="size-4" aria-hidden /> Back to the catalogue
        </Link>
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <Picture id={product.imageId} url={product.imageUrl} alt={product.name} className="aspect-square w-full" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--site-accent)]">Ref. {product.code}</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--site-dark)] sm:text-4xl">{product.name}</h1>
            {product.description && <p className="mt-5 whitespace-pre-line text-lg leading-relaxed text-slate-600">{product.description}</p>}
            <div className="mt-8 rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-[var(--site-dark)]">Ask for a quote</h2>
              <p className="mt-1 text-sm text-slate-600">We reply with price and availability.</p>
              {wa && (
                <a href={wa} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25d366] px-5 py-2.5 font-semibold text-white">
                  <MessageCircle className="size-5" aria-hidden /> Ask on WhatsApp
                </a>
              )}
              <div className="mt-5">
                <ContactForm slug={site.slug} product={{ id: product.productId, name: product.name }} />
              </div>
            </div>
          </div>
        </div>
      </section>
      {others.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <SectionTitle title="You may also need" />
          <div className="mt-8">
            <ProductGrid base={base} products={others} />
          </div>
        </section>
      )}
    </>
  );
}

export default function ProductPage({ params }: PageProps<"/site/[company]/catalogue/[code]">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Product params={params} />
    </Suspense>
  );
}
