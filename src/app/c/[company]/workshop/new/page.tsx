import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { getCatalogue } from "@/lib/data/inventory";
import { listCustomers } from "@/lib/data/sales";
import { vesselOptions } from "@/lib/data/vessels";
import { COMPANIES } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { JobCardForm } from "../job-card-form";

async function NewJobCard({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ vessel?: string; customer?: string }> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "workshop");
  const [vessels, customers, catalogue] = await Promise.all([vesselOptions(), listCustomers(), getCatalogue()]);
  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Workshop`}
        title="New job card"
        description="For work on a boat. If the customer first needs a price to approve, make an offer instead and start the job card from it."
      />
      <div className="mt-6">
        <JobCardForm
          key={crypto.randomUUID()}
          companySlug={slug}
          vessels={vessels}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          catalogue={catalogue.filter((c) => c.active).map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type, priceHT: c.priceHT }))}
          defaults={{ vesselId: search.vessel, customerId: search.customer }}
        />
      </div>
    </>
  );
}

export default function NewJobCardPage({ params, searchParams }: PageProps<"/c/[company]/workshop/new">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewJobCard params={params} searchParams={searchParams as Promise<{ vessel?: string; customer?: string }>} />
    </Suspense>
  );
}
