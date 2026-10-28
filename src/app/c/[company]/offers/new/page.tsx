import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { COMPANIES } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { OfferEditor } from "../offer-editor";
import { offerEditorData } from "../editor-data";

async function NewOffer({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { slug } = await requireModule(company, "offers");
  const data = await offerEditorData(slug);

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="New offer"
        description="The offer number is assigned when you save."
      />
      {/* New key per visit: Next keeps visited pages alive, and a saved offer must not reappear. */}
      <OfferEditor
        key={crypto.randomUUID()}
        companySlug={slug}
        companyName={data.company.legalName || COMPANIES[slug].name}
        catalogue={data.catalogue}
        customers={data.customers}
        defaultIntro={data.defaultIntro}
        defaultTerms={data.defaultTerms}
      />
    </>
  );
}

export default function NewOfferPage({ params }: PageProps<"/c/[company]/offers/new">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewOffer params={params} />
    </Suspense>
  );
}
