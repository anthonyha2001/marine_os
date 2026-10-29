import { Suspense } from "react";
import type { Metadata } from "next";
import { CtaBand, Picture, SectionTitle } from "../blocks";
import { siteContext } from "../site";
import { ElicheAbout } from "../_eliche/pages";

export const metadata: Metadata = { title: "About us" };

async function About({ params }: { params: Promise<{ company: string }> }) {
  const { site, base, visible } = await siteContext(params);
  if (!visible) return null;
  if (site.slug === "eliche-radice") return <ElicheAbout site={site} base={base} />;
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-start gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SectionTitle eyebrow="About us" title={site.aboutTitle} />
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-600">
            {site.aboutText.split(/\n\s*\n/).map((para, i) => (
              <p key={i} className="whitespace-pre-line">
                {para}
              </p>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl shadow-xl shadow-slate-900/10 lg:sticky lg:top-28">
          {site.aboutImageId ? (
            <Picture id={site.aboutImageId} alt={site.aboutTitle} className="aspect-[4/5] w-full" />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center bg-slate-50 p-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={site.logo} alt={site.name} className="max-h-32 w-auto" />
            </div>
          )}
        </div>
      </section>
      {site.highlights.length > 0 && (
        <section className="bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6">
            {site.highlights.map((h) => (
              <div key={h.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <p className="text-lg font-semibold text-[var(--site-dark)]">{h.title}</p>
                {h.body && <p className="mt-2 leading-relaxed text-slate-600">{h.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      <CtaBand base={base} site={site} />
    </>
  );
}

export default function AboutPage({ params }: PageProps<"/site/[company]/about">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <About params={params} />
    </Suspense>
  );
}
