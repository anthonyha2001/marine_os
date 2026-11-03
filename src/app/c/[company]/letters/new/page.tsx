import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { COMPANIES } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { LetterEditor } from "../letter-editor";
import { letterEditorData } from "../editor-data";

type Search = { customer?: string; offer?: string };

async function NewLetter({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "offers");
  const data = await letterEditorData(slug);

  return (
    <>
      <PageHeader eyebrow={COMPANIES[slug].name} title="New letter" description="An official letter on the company letterhead. The number is assigned when you save." />
      {/* New key per visit: Next keeps visited pages alive, and a saved letter must not reappear. */}
      <LetterEditor
        key={crypto.randomUUID()}
        companySlug={slug}
        companyName={data.company.legalName || COMPANIES[slug].name}
        customers={data.customers}
        offers={data.offers}
        userName={user.name}
        defaultCustomerId={search.customer}
        defaultOfferId={search.offer}
      />
    </>
  );
}

export default function NewLetterPage({ params, searchParams }: PageProps<"/c/[company]/letters/new">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewLetter params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
