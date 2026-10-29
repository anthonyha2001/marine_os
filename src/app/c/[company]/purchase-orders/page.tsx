import { Suspense } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { listPurchaseOrders } from "@/lib/data/purchase-orders";
import { deletePurchaseOrder } from "@/lib/actions/purchase-orders";
import { formatMoney } from "@/lib/money";
import { COMPANIES, can, isAdmin } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { ButtonLink, PageHeader, cardClass } from "@/components/ui";
import { PoStatusSelect } from "./po-status-select";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

async function PurchaseOrdersContent({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { user, slug } = await requireModule(company, "purchases");
  const mayDelete = (status: string) => isAdmin(user) || (status === "DRAFT" && can(user, "deleteDrafts"));
  const orders = await listPurchaseOrders(slug);
  const base = `/c/${slug}/purchase-orders`;
  const open = orders.filter((o) => o.status === "DRAFT" || o.status === "SENT");

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Purchase orders"
        description="Orders sent to suppliers. Receive one when the goods arrive to add them to stock."
        action={<ButtonLink icon={Plus} href={`${base}/new`}>New purchase order</ButtonLink>}
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Open orders", String(open.length), "draft or sent"],
          ["Value of open orders", formatMoney(open.reduce((s, o) => s + o.totalTTC, 0)), "incl. VAT"],
          ["Received", String(orders.filter((o) => o.status === "RECEIVED").length), "added to stock"],
        ].map(([label, value, hint]) => (
          <div key={label} className={`${cardClass} p-4`}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>
            <p className="text-xs text-muted">{hint}</p>
          </div>
        ))}
      </div>

      <div className={`${cardClass} mt-6 overflow-x-auto`}>
        {orders.length === 0 ? (
          <p className="p-10 text-center text-muted">No purchase orders yet.</p>
        ) : (
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3 text-right">Lines</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="w-16 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id} className={`hover:bg-background/60 ${o.status === "CANCELLED" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <Link href={`${base}/${o.id}`} className="font-mono font-medium text-brand hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{dateFormat.format(o.orderDate)}</td>
                  <td className="px-4 py-3 font-medium text-navy">{o.supplierName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{o.expectedDate ? dateFormat.format(o.expectedDate) : "—"}</td>
                  <td className="px-4 py-3 text-right">{o.lineCount}</td>
                  <td className="px-4 py-3">
                    <PoStatusSelect companySlug={slug} orderId={o.id} status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(o.totalTTC)}</td>
                  <td className="px-2 py-3 text-right">
                    {o.status !== "RECEIVED" && mayDelete(o.status) && (
                      <DeleteButton
                        action={deletePurchaseOrder.bind(null, slug, o.id)}
                        confirmText={`Delete purchase order ${o.number}? It goes to the recycle bin and can be restored.`}
                        title="Delete purchase order"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function PurchaseOrdersPage({ params }: PageProps<"/c/[company]/purchase-orders">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading purchase orders…</p>}>
      <PurchaseOrdersContent params={params} />
    </Suspense>
  );
}
