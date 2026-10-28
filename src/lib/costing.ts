import "server-only";
import { prisma, type Tx } from "@/lib/prisma";
import { round2 } from "@/lib/money";

// What products really cost. This is management information (profit per job / sale / product);
// the books keep purchases as expenses (periodic inventory), so nothing here posts entries.

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Real unit cost of each item of a purchase: its price after the bill's discount, plus the
 * landed costs (freight, customs…) spread by value. Saved on the purchase items.
 */
export async function recomputePurchaseCosts(tx: Tx, purchaseId: string) {
  const purchase = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { items: true, landedCosts: true } });
  if (!purchase) return;
  const subtotal = Number(purchase.subtotalHT);
  const afterDiscount = subtotal > 0 ? Number(purchase.totalHT) / subtotal : 1;
  const landed = purchase.landedCosts.reduce((s, c) => s + Number(c.amount), 0);
  const base = purchase.items.reduce((s, i) => s + Number(i.lineTotalHT) * afterDiscount, 0);
  for (const item of purchase.items) {
    const value = Number(item.lineTotalHT) * afterDiscount;
    const share = base > 0 ? (value / base) * landed : 0;
    const unitCost = item.quantity > 0 ? round4((value + share) / item.quantity) : 0;
    await tx.purchaseItem.update({ where: { id: item.id }, data: { unitCost } });
  }
}

/**
 * Weighted average cost per product for a company, from what it bought (real cost) and what it
 * received from the sister company. Products never bought have no cost (0).
 */
export async function averageCosts(companyId: string, db: Tx | typeof prisma = prisma) {
  const [items, transfers] = await Promise.all([
    db.purchaseItem.findMany({
      where: { purchase: { companyId } },
      select: { productId: true, quantity: true, unitCost: true, unitPriceHT: true, purchase: { select: { subtotalHT: true, totalHT: true } } },
    }),
    db.stockTransferLine.findMany({ where: { transfer: { toCompanyId: companyId, status: "RECEIVED" } }, select: { productId: true, quantity: true, unitCost: true } }),
  ]);
  const sums = new Map<string, { qty: number; value: number }>();
  const add = (productId: string, qty: number, cost: number) => {
    const s = sums.get(productId) ?? { qty: 0, value: 0 };
    s.qty += qty;
    s.value += qty * cost;
    sums.set(productId, s);
  };
  for (const i of items) {
    const subtotal = Number(i.purchase.subtotalHT);
    const fallback = Number(i.unitPriceHT) * (subtotal > 0 ? Number(i.purchase.totalHT) / subtotal : 1);
    add(i.productId, i.quantity, i.unitCost === null ? fallback : Number(i.unitCost));
  }
  for (const t of transfers) add(t.productId, t.quantity, Number(t.unitCost));
  return new Map([...sums].map(([id, s]) => [id, s.qty > 0 ? round4(s.value / s.qty) : 0]));
}

export type ProfitFigures = { revenue: number; cost: number; profit: number; margin: number | null };
export const profitOf = (revenue: number, cost: number): ProfitFigures => {
  const profit = round2(revenue - cost);
  return { revenue: round2(revenue), cost: round2(cost), profit, margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null };
};
