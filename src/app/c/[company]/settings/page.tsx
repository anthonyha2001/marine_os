import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/data/sales";
import { DEFAULT_TERMS } from "@/lib/offers";
import { COMPANIES } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { CompanyForm } from "./company-form";

async function SettingsContent({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { slug } = await requireModule(company, "settings");
  const profile = await getCompanyProfile(slug);

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Company details"
        description="Printed on the letterhead and footer of every offer PDF for this company."
      />
      <CompanyForm companySlug={slug} profile={profile} defaultTerms={DEFAULT_TERMS} />
    </>
  );
}

export default function SettingsPage({ params }: PageProps<"/c/[company]/settings">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <SettingsContent params={params} />
    </Suspense>
  );
}
