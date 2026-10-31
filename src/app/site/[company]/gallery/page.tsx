import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CtaBand, PageHero, Picture } from "../blocks";
import { siteContext } from "../site";
import { ErPage } from "../_er/render";

export const metadata: Metadata = { title: "Gallery" };

async function Gallery({ params }: { params: Promise<{ company: string }> }) {
  const { site, base, visible } = await siteContext(params);
  if (!visible) return null;
  if (site.slug === "eliche-radice") return <ErPage site={site} base={base} slug="gallery" />;
  const items = site.gallery.filter((g) => g.published);
  if (!site.showGallery || !items.length) notFound();
  return (
    <>
      <PageHero eyebrow="Gallery" title="Our work" text="A selection of boats we've worked on and projects we've delivered." />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {items.map((g) => (
            <figure key={g.id} className="mb-5 break-inside-avoid overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <Picture id={g.imageId} alt={g.title} className="w-full" />
              <figcaption className="p-4">
                <p className="font-semibold text-[var(--site-dark)]">{g.title}</p>
                {g.caption && <p className="mt-1 text-sm leading-relaxed text-slate-600">{g.caption}</p>}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <CtaBand base={base} site={site} />
    </>
  );
}

export default function GalleryPage({ params }: PageProps<"/site/[company]/gallery">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Gallery params={params} />
    </Suspense>
  );
}
