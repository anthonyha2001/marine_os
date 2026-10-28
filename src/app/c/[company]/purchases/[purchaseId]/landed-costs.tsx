import { prisma } from "@/lib/prisma";
import { deleteLandedCost } from "@/lib/actions/purchases";
import { formatMoney, round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { cardClass } from "@/components/ui";
import { LandedCostForm } from "./landed-cost-form";

const fmt4 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Freight, customs and clearing spread over the items: shows each item's real unit cost. */
export async function LandedCostsSection({ slug, purchaseId }: { slug: CompanySlug; purchaseId: string }) {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { landedCosts: { orderBy: { createdAt: "asc" } }, items: { include: { product: { select: { code: true, name: true } } } } },
  });
  if (!purchase) return null;
  const total = round2(purchase.landedCosts.reduce((s, c) => s + Number(c.amount), 0));

  return (
    <section className={`${cardClass} mt-6 p-5`}>
      <h2 className="font-semibold text-navy">Landed costs</h2>
      <p className="mt-1 text-sm text-muted">
        Freight, customs, clearing… paid to get these goods here. They are spread over the items by value to give each item its real cost, used for profit
        reports. Record the payment itself with a payment voucher or as the forwarder&apos;s bill.
      </p>
      {purchase.landedCosts.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
          {purchase.landedCosts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-navy">{c.description}</span>
              <span className="flex items-center gap-2">
                <span className="tabular font-medium">{formatMoney(Number(c.amount))}</span>
                <DeleteButton action={deleteLandedCost.bind(null, slug, purchaseId, c.id)} confirmText={`Remove “${c.description}” from this purchase's costs?`} title="Remove cost" />
              </span>
            </li>
          ))}
          <li className="flex justify-between px-3 py-2 font-semibold text-navy">
            <span>Total landed costs</span>
            <span className="tabular">{formatMoney(total)}</span>
          </li>
        </ul>
      )}
      <div className="mt-3">
        <LandedCostForm companySlug={slug} purchaseId={purchaseId} />
      </div>
      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Bought at</th>
            <th className="py-2 text-right">Real unit cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {purchase.items.map((i) => (
            <tr key={i.id}>
              <td className="py-2">
                <span className="font-mono text-xs text-muted">{i.product.code}</span> {i.product.name}
              </td>
              <td className="tabular py-2 text-right text-muted">{formatMoney(Number(i.unitPriceHT))}</td>
              <td className="tabular py-2 text-right font-semibold text-navy">{i.unitCost === null ? "—" : fmt4.format(Number(i.unitCost))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
