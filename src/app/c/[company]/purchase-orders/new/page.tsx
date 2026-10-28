import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { listSuppliers, productCatalogue } from "@/lib/data/inventory";
import { COMPANIES } from "@/lib/permissions";
import { ButtonLink, PageHeader, cardClass } from "@/components/ui";
import { PurchaseOrderForm } from "../purchase-order-form";

async function NewPurchaseOrder({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { slug } = await requireModule(company, "purchases");
  const [suppliers, catalogue] = await Promise.all([listSuppliers(), productCatalogue()]);

  if (suppliers.length === 0) {
    return (
      <>
        <PageHeader eyebrow={COMPANIES[slug].name} title="New purchase order" />
        <div className={`${cardClass} mt-6 p-10 text-center`}>
          <p className="text-muted">Add a supplier first.</p>
          <div className="mt-4">
            <ButtonLink href={`/c/${slug}/suppliers`}>Add a supplier</ButtonLink>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="New purchase order"
        description="The number is assigned when you save. New products can be created right from the lines."
      />
      {/* New key per visit: Next keeps visited pages alive, and a saved order must not reappear. */}
      <PurchaseOrderForm
        key={crypto.randomUUID()}
        companySlug={slug}
        companyName={COMPANIES[slug].name}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        catalogue={catalogue}
      />
    </>
  );
}

export default function NewPurchaseOrderPage({ params }: PageProps<"/c/[company]/purchase-orders/new">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewPurchaseOrder params={params} />
    </Suspense>
  );
}
