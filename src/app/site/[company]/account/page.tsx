import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteContext } from "../site";
import { ErAccount } from "../_er/render";

export const metadata: Metadata = { title: "My account" };

async function Account({ params }: { params: Promise<{ company: string }> }) {
  const { site, base, visible } = await siteContext(params);
  if (!visible) return null;
  if (site.slug !== "eliche-radice") notFound();
  return <ErAccount site={site} base={base} />;
}

export default function AccountPage({ params }: PageProps<"/site/[company]/account">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Account params={params} />
    </Suspense>
  );
}
