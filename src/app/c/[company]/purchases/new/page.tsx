import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { listSuppliers, productCatalogue } from "@/lib/data/inventory";
import { getPurchaseOrder } from "@/lib/data/purchase-orders";
import { COMPANIES } from "@/lib/permissions";
import { ButtonLink, PageHeader, cardClass } from "@/components/ui";
import { PurchaseForm, type PurchaseFromOrder } from "../purchase-form";

async function NewPurchase({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ po?: string }>;
}) {
  const [{ company }, { po }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "purchases");
  const [suppliers, catalogue, order] = await Promise.all([
    listSuppliers(),
    productCatalogue(),
    po ? getPurchaseOrder(slug, po) : null,
  ]);

  if (po && (!order || order.status === "RECEIVED" || order.status === "CANCELLED")) {
    return (
      <>
        <PageHeader eyebrow={COMPANIES[slug].name} title="Receive purchase order" />
        <div className={`${cardClass} mt-6 p-10 text-center`}>
          <p className="text-muted">
            {order ? `Purchase order ${order.number} is ${order.status.toLowerCase()}, so it can't be received.` : "This purchase order no longer exists."}
          </p>
          <div className="mt-4">
            <ButtonLink href={`/c/${slug}/purchase-orders`}>Back to purchase orders</ButtonLink>
          </div>
        </div>
      </>
    );
  }

  if (suppliers.length === 0) {
    return (
      <>
        <PageHeader eyebrow={COMPANIES[slug].name} title="New purchase" />
        <div className={`${cardClass} mt-6 p-10 text-center`}>
          <p className="text-muted">Before entering a purchase you need at least one supplier.</p>
          <div className="mt-4">
            <ButtonLink href={`/c/${slug}/suppliers`}>Add a supplier</ButtonLink>
          </div>
        </div>
      </>
    );
  }

  const fromOrder: PurchaseFromOrder | undefined = order
    ? {
        purchaseOrderId: order.id,
        number: order.number,
        supplierId: order.supplierId,
        discount: order.discount,
        rows: order.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPriceHT: l.unitPriceHT })),
      }
    : undefined;

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title={order ? `Receive ${order.number}` : "New purchase"}
        description={`Saved for ${COMPANIES[slug].name}; quantities are added to its stock.`}
      />
      {/* New key per visit: Next keeps visited pages alive, and a saved purchase must not reappear. */}
      <PurchaseForm
        key={crypto.randomUUID()}
        companySlug={slug}
        companyName={COMPANIES[slug].name}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        catalogue={catalogue}
        fromOrder={fromOrder}
      />
    </>
  );
}

export default function NewPurchasePage({ params, searchParams }: PageProps<"/c/[company]/purchases/new">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewPurchase params={params} searchParams={searchParams as Promise<{ po?: string }>} />
    </Suspense>
  );
}
