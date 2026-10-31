import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiveGoodsDialog } from "@/components/create-dialogs";
import { requireModule } from "@/lib/auth";
import { listSuppliers, productCatalogue } from "@/lib/data/inventory";
import { PO_STATUSES, getPurchaseOrder } from "@/lib/data/purchase-orders";
import { deletePurchaseOrder } from "@/lib/actions/purchase-orders";
import { formatMoney } from "@/lib/money";
import { COMPANIES, can, isAdmin } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { OrderTotals } from "@/components/order-lines";
import { ButtonLink, Kbd, PageHeader, cardClass, primaryButton, secondaryButton } from "@/components/ui";
import { PurchaseOrderForm } from "../purchase-order-form";
import { PdfShortcut } from "./pdf-shortcut";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

async function PurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; orderId: string }>;
  searchParams: Promise<{ saved?: string; create?: string }>;
}) {
  const [{ company, orderId }, { saved, create }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "purchases");
  const order = await getPurchaseOrder(slug, orderId);
  if (!order) notFound();
  const editable = order.status === "DRAFT" || order.status === "SENT";
  const [suppliers, catalogue] = editable ? await Promise.all([listSuppliers(), productCatalogue()]) : [[], []];
  const pdfUrl = `/c/${slug}/purchase-orders/${order.id}/pdf`;

  return (
    <>
      <PdfShortcut url={pdfUrl} />
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Purchase order · ${PO_STATUSES[order.status]}`}
        title={order.number}
        description={order.supplier.name}
        action={
          <div className="flex flex-wrap gap-2">
            {editable && (
              <ButtonLink href={`/c/${slug}/purchase-orders/${order.id}?create=receive`}>Receive goods</ButtonLink>
            )}
            <a href={pdfUrl} target="_blank" rel="noopener" className={`${editable ? secondaryButton : primaryButton} gap-2`}>
              Open PDF <Kbd>Ctrl P</Kbd>
            </a>
            <a href={`${pdfUrl}?download=1`} className={secondaryButton}>
              Download PDF
            </a>
            {order.status !== "RECEIVED" && (isAdmin(user) || (order.status === "DRAFT" && can(user, "deleteDrafts"))) && (
              <DeleteButton
                bordered
                action={deletePurchaseOrder.bind(null, slug, order.id)}
                confirmText={`Delete purchase order ${order.number}? It goes to the recycle bin and can be restored.`}
                title="Delete purchase order"
              />
            )}
          </div>
        }
      />

      {saved && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
          Purchase order saved.
        </p>
      )}

      {order.status === "RECEIVED" && order.purchaseId && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
          Received and added to stock.{" "}
          <Link href={`/c/${slug}/purchases/${order.purchaseId}`} className="font-medium underline">
            View the purchase
          </Link>
        </p>
      )}

      {editable ? (
        /* New key per render so the form always shows what was just saved. */
        <PurchaseOrderForm
          key={crypto.randomUUID()}
          companySlug={slug}
          companyName={COMPANIES[slug].name}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          catalogue={catalogue}
          order={{
            id: order.id,
            supplierId: order.supplierId,
            orderDate: iso(order.orderDate),
            expectedDate: order.expectedDate ? iso(order.expectedDate) : null,
            status: order.status as "DRAFT" | "SENT",
            reference: order.reference,
            terms: order.terms,
            notes: order.notes,
            discount: order.discount,
            rows: order.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPriceHT: l.unitPriceHT })),
          }}
        />
      ) : (
        <>
          <dl className={`${cardClass} mt-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4`}>
            {[
              ["Supplier", order.supplier.name],
              ["Order date", dateFormat.format(order.orderDate)],
              ["Expected delivery", order.expectedDate ? dateFormat.format(order.expectedDate) : "—"],
              ["Reference", order.reference ?? "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
                <dd className="mt-1 text-sm font-medium text-navy">{value}</dd>
              </div>
            ))}
          </dl>
          <div className={`${cardClass} mt-6 overflow-x-auto`}>
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Unit price excl. VAT</th>
                  <th className="px-4 py-3 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-mono text-muted">{l.code}</td>
                    <td className="px-4 py-3 font-medium text-navy">{l.name}</td>
                    <td className="px-4 py-3 text-right">{l.quantity}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(l.unitPriceHT)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(l.lineTotalHT)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-end">
            <div className={`${cardClass} w-full max-w-sm p-5 text-sm`}>
              <OrderTotals totals={order} />
            </div>
          </div>
        </>
      )}
      {create === "receive" && <ReceiveGoodsDialog slug={slug} closeHref={`/c/${slug}/purchase-orders/${order.id}`} orderId={order.id} />}
    </>
  );
}

export default function PurchaseOrderDetailPage({ params, searchParams }: PageProps<"/c/[company]/purchase-orders/[orderId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <PurchaseOrderPage params={params} searchParams={searchParams as Promise<{ saved?: string; create?: string }>} />
    </Suspense>
  );
}
