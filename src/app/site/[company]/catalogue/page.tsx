import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { CtaBand, PageHero, ProductGrid } from "../blocks";
import { siteContext } from "../site";
import { ElicheCatalogue } from "../_eliche/pages";

export const metadata: Metadata = { title: "Catalogue" };

async function Catalogue({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ site, base, visible }, { q = "" }] = await Promise.all([siteContext(params), searchParams]);
  if (!visible) return null;
  if (!site.showCatalogue) notFound();
  if (site.slug === "eliche-radice") return <ElicheCatalogue site={site} base={base} q={q} />;
  const needle = q.trim().toLowerCase();
  const products = site.listings.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.code.includes(needle) || (p.description ?? "").toLowerCase().includes(needle));
  return (
    <>
      <PageHero eyebrow="Catalogue" title="Products" text="Ask for a quote on any product: we reply with price and availability, usually the same day." />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <form className="relative max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search products"
            aria-label="Search products"
            className="w-full rounded-full border border-slate-300 bg-white py-3 pl-12 pr-4 outline-none focus:border-[var(--site-accent)] focus:ring-4 focus:ring-[var(--site-accent-soft)]"
          />
        </form>
        <div className="mt-8">
          {products.length ? (
            <ProductGrid base={base} products={products} />
          ) : (
            <p className="rounded-2xl bg-slate-50 p-10 text-center text-slate-600">{q ? "No product matches your search. Contact us: we can probably find it." : "Our catalogue is coming soon."}</p>
          )}
        </div>
      </section>
      <CtaBand base={base} site={site} />
    </>
  );
}

export default function CataloguePage({ params, searchParams }: PageProps<"/site/[company]/catalogue">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Catalogue params={params} searchParams={searchParams as Promise<{ q?: string }>} />
    </Suspense>
  );
}
