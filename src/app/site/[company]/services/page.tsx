import { Suspense } from "react";
import type { Metadata } from "next";
import { CtaBand, PageHero, ServiceGrid } from "../blocks";
import { siteContext } from "../site";
import { ErPage } from "../_er/render";

export const metadata: Metadata = { title: "Services" };

async function Services({ params }: { params: Promise<{ company: string }> }) {
  const { site, base, visible } = await siteContext(params);
  if (!visible) return null;
  if (site.slug === "eliche-radice") return <ErPage site={site} base={base} slug="services" />;
  return (
    <>
      <PageHero eyebrow="Services" title="What we can do for you" text={site.heroText} />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <ServiceGrid services={site.services.filter((s) => s.published)} />
      </section>
      <CtaBand base={base} site={site} />
    </>
  );
}

export default function ServicesPage({ params }: PageProps<"/site/[company]/services">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Services params={params} />
    </Suspense>
  );
}
