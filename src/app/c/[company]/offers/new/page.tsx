import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { COMPANIES } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { OfferEditor } from "../offer-editor";
import { offerEditorData } from "../editor-data";

async function NewOffer({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ customer?: string }> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
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
        vessels={data.vessels}
        clauses={data.clauses}
        defaultIntro={data.defaultIntro}
        defaultTerms={data.defaultTerms}
        defaultCustomerId={search.customer}
      />
    </>
  );
}

export default function NewOfferPage({ params, searchParams }: PageProps<"/c/[company]/offers/new">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewOffer params={params} searchParams={searchParams as Promise<{ customer?: string }>} />
    </Suspense>
  );
}
