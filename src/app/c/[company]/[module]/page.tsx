import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { COMPANIES, MODULES, type ModuleKey } from "@/lib/permissions";
import { ButtonLink, EmptyState, PageHeader, cardClass } from "@/components/ui";

// Placeholder for modules that aren't built yet (they're hidden from the sidebar).
// Built modules have their own folders, which take priority over this route.

function isModuleKey(value: string): value is ModuleKey {
  return value in MODULES;
}

async function ModuleContent({ params }: { params: Promise<{ company: string; module: string }> }) {
  const { company, module } = await params;
  if (!isModuleKey(module)) notFound();
  const { slug } = await requireModule(company, module);

  return (
    <>
      <PageHeader eyebrow={COMPANIES[slug].name} title={MODULES[module].label} />
      <div className={`${cardClass} mt-6`}>
        <EmptyState
          icon={Hammer}
          title="Coming soon"
          description={`${MODULES[module].label} is planned for a later release.`}
          action={<ButtonLink href={`/c/${slug}/dashboard`} variant="secondary">Back to the dashboard</ButtonLink>}
        />
      </div>
    </>
  );
}

export default function ModulePage({ params }: PageProps<"/c/[company]/[module]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-200/70" />}>
      <ModuleContent params={params} />
    </Suspense>
  );
}
