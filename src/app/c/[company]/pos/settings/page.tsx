import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { getPosRules } from "@/lib/data/pos";
import { hasPos } from "@/lib/pos";
import { COMPANIES } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { PosSettingsForm } from "./settings-form";

async function SettingsContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "posAdmin");
  if (!hasPos(slug)) notFound();
  const rules = await getPosRules(slug);
  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Point of sale`}
        title="POS settings"
        description="What cashiers can do at the till. Managers and admins aren't limited by the cashier rules."
      />
      {search.saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Settings saved. The till uses them from the next sale.
        </p>
      )}
      {!rules.saved && !search.saved && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">These are the default settings. Review them and save.</p>
      )}
      <div className="mt-6">
        <PosSettingsForm key={search.saved ?? "form"} companySlug={slug} rules={rules} />
      </div>
    </>
  );
}

export default function PosSettingsPage({ params, searchParams }: PageProps<"/c/[company]/pos/settings">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading settings…</p>}>
      <SettingsContent params={params} searchParams={searchParams as Promise<{ saved?: string }>} />
    </Suspense>
  );
}
