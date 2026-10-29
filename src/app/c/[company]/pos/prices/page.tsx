import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { posPricing } from "@/lib/data/pos";
import { hasPos } from "@/lib/pos";
import { COMPANIES } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { PricingGrid } from "./pricing-grid";

async function PricesContent({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { slug } = await requireModule(company, "posAdmin");
  if (!hasPos(slug)) notFound();
  const rows = (await posPricing(slug)).filter((r) => r.active);
  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Retail`}
        title="Prices & margins"
        description="The shelf price the till sells at, with the margin on each product against its average cost."
      />
      <div className="mt-6">
        <PricingGrid companySlug={slug} rows={rows} />
      </div>
    </>
  );
}

export default function PosPricesPage({ params }: PageProps<"/c/[company]/pos/prices">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading prices…</p>}>
      <PricesContent params={params} />
    </Suspense>
  );
}
