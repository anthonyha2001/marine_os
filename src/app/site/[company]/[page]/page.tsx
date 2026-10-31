import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPage, getSite } from "@/lib/data/website";
import { isCompanySlug } from "@/lib/permissions";
import { siteContext } from "../site";
import { ErPage } from "../_er/render";

export async function generateMetadata({ params }: PageProps<"/site/[company]/[page]">): Promise<Metadata> {
  const { company, page } = await params;
  if (!isCompanySlug(company)) return {};
  const found = findPage(await getSite(company), page);
  return found ? { title: found.seoTitle || found.title, description: found.seoDescription ?? undefined } : {};
}

async function CustomPage({ params }: { params: Promise<{ company: string; page: string }> }) {
  const [{ site, base, visible }, { page }] = await Promise.all([siteContext(params), params]);
  if (!visible) return null;
  // Pages made in Marketing → Website → Pages (Eliche Radice for now).
  if (site.slug !== "eliche-radice") notFound();
  return <ErPage site={site} base={base} slug={page} />;
}

export default function SitePage({ params }: PageProps<"/site/[company]/[page]">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <CustomPage params={params} />
    </Suspense>
  );
}
