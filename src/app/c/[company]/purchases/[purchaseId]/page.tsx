import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RegisterSerialsDialog } from "@/components/create-dialogs";
import { requireModule } from "@/lib/auth";
import { getPurchase } from "@/lib/data/inventory";
import { formatMoney, VAT_RATE } from "@/lib/money";
import { COMPANIES, can, canAccessModule, isAdmin } from "@/lib/permissions";
import { LandedCostsSection } from "./landed-costs";
import { PaymentsSection } from "./payments-section";
import Link from "next/link";
import { ButtonLink, PageHeader, cardClass } from "@/components/ui";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

async function PurchaseDetail({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; purchaseId: string }>;
  searchParams: Promise<{ create?: string; product?: string }>;
}) {
  const [{ company, purchaseId }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "purchases");
  // Only finds purchases of this company, so another company's invoice can't be opened by URL.
  const purchase = await getPurchase(slug, purchaseId);
  if (!purchase) notFound();

  const facts = [
    ["Supplier", purchase.supplierName + (purchase.supplierAccount ? ` (account ${purchase.supplierAccount})` : "")],
    ["Invoice number", purchase.invoiceNumber],
    ["Invoice date", dateFormat.format(purchase.purchaseDate)],
    ["Reference", purchase.reference ?? "—"],
    ["Payment due", dateFormat.format(purchase.dueDate)],
    ["Company", COMPANIES[slug].name],
    ["Entered by", `${purchase.createdByName}, ${purchase.createdAt.toLocaleString("en-GB")}`],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Purchases"
        title={`Invoice ${purchase.invoiceNumber}`}
        description={purchase.supplierName}
        action={<ButtonLink href={`/c/${slug}/purchases`} variant="secondary">← All purchases</ButtonLink>}
      />

      <dl className={`${cardClass} mt-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3`}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-navy">{value}</dd>
          </div>
        ))}
      </dl>

      {purchase.purchaseOrder && (
        <p className="mt-3 text-sm text-muted">
          Received from purchase order{" "}
          <Link href={`/c/${slug}/purchase-orders/${purchase.purchaseOrder.id}`} className="font-mono text-brand hover:underline">
            {purchase.purchaseOrder.number}
          </Link>
        </p>
      )}

      <PaymentsSection
        slug={slug}
        purchase={{ id: purchase.id, invoiceNumber: purchase.invoiceNumber, supplierName: purchase.supplierName, totalTTC: purchase.totalTTC, dueDate: purchase.dueDate }}
        canRecord={canAccessModule(user, slug, "accounting")}
        admin={isAdmin(user)}
        mayCancel={can(user, "cancelEntries")}
      />

      <LandedCostsSection slug={slug} purchaseId={purchase.id} />

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
            {purchase.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-mono text-muted">{item.code}</td>
                <td className="px-4 py-3 font-medium text-navy">{item.name}</td>
                <td className="px-4 py-3 text-right">{item.quantity}</td>
                <td className="px-4 py-3 text-right">{formatMoney(item.unitPriceHT)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(item.lineTotalHT)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="text-sm text-muted">{purchase.notes && <p className="whitespace-pre-line">{purchase.notes}</p>}</div>
        <dl className={`${cardClass} space-y-2 p-5 text-sm`}>
          <div className="flex justify-between"><dt className="text-muted">Subtotal excl. VAT</dt><dd>{formatMoney(purchase.subtotalHT)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>− {formatMoney(purchase.discount)}</dd></div>
          <div className="flex justify-between font-medium"><dt>Total excl. VAT</dt><dd>{formatMoney(purchase.totalHT)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">VAT {VAT_RATE * 100}%</dt><dd>{formatMoney(purchase.vatAmount)}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-navy"><dt>Total incl. VAT</dt><dd>{formatMoney(purchase.totalTTC)}</dd></div>
        </dl>
      </div>
      {search.create === "serials" && (
        <RegisterSerialsDialog slug={slug} closeHref={`/c/${slug}/purchases/${purchaseId}`} productId={search.product} purchaseId={purchaseId} />
      )}
    </>
  );
}

export default function PurchaseDetailPage({ params, searchParams }: PageProps<"/c/[company]/purchases/[purchaseId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <PurchaseDetail params={params} searchParams={searchParams as Promise<{ create?: string; product?: string }>} />
    </Suspense>
  );
}
