import "server-only";
import { prisma } from "@/lib/prisma";
import { averageCosts, profitOf, type ProfitFigures } from "@/lib/costing";
import { companyIdFor } from "@/lib/data/inventory";
import { listSales, type SaleRow } from "@/lib/data/pos";
import { getCompanyProfile } from "@/lib/data/sales";
import type { JobCardRow } from "@/lib/data/workshop";
import { listJobCards } from "@/lib/data/workshop";
import { round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";

// Profit = revenue excl. VAT − real cost (parts at average cost incl. landed costs, labour at the
// company's hourly cost). Management figures: the books are not changed.

/** A job card's profit. Parts used on a finished job keep the cost they had when it was done. */
export function jobProfit(job: JobCardRow, avg: Map<string, number>, labourPerHour: number) {
  let parts = 0;
  let hours = 0;
  for (const l of job.lines) {
    if (l.kind === "LABOR") hours += l.quantity;
    else if (l.kind === "PART" && l.productId) parts += l.quantity * (job.status === "DONE" && l.unitCost ? l.unitCost : (avg.get(l.productId) ?? 0));
  }
  const labour = round2(hours * labourPerHour);
  return { ...profitOf(job.totalHT, parts + labour), parts: round2(parts), labour, hours };
}

/** A counter sale's profit, net of goods returned. */
export function saleProfit(sale: SaleRow) {
  const discount = 1 - sale.discountPct / 100;
  let revenue = 0;
  let cost = 0;
  for (const l of sale.lines) {
    const kept = l.quantity - l.refunded;
    revenue += l.unitPriceHT * kept * discount;
    cost += l.unitCost * kept;
  }
  return profitOf(revenue, cost);
}

type Row = { id: string; label: string; date: Date; who: string; href: string } & ProfitFigures;

export async function profitReport(slug: CompanySlug, period: { from?: Date; to?: Date }) {
  const companyId = await companyIdFor(slug);
  const inPeriod = (d: Date) => (!period.from || d >= period.from) && (!period.to || d <= period.to);
  const [avg, profile, jobs, sales, offers] = await Promise.all([
    averageCosts(companyId),
    getCompanyProfile(slug),
    listJobCards(slug),
    listSales(slug),
    prisma.offer.findMany({
      where: { companyId, status: "ACCEPTED" },
      select: { id: true, number: true, offerDate: true, customerName: true, totalHT: true, subtotal: true, lines: { where: { kind: "ITEM" }, select: { productId: true, quantity: true, product: { select: { type: true } } } } },
    }),
  ]);

  const jobRows: Row[] = jobs
    .filter((j) => j.status !== "CANCELLED" && !j.offer && inPeriod(j.openedAt))
    .map((j) => ({ id: j.id, label: j.number, date: j.openedAt, who: j.vessel?.name ? `${j.vessel.name} · ${j.customerName}` : j.customerName, href: `/c/${slug}/workshop/${j.id}`, ...jobProfit(j, avg, profile.labourCostPerHour) }));
  const saleRows: Row[] = sales
    .filter((s) => inPeriod(s.saleDate) && s.status !== "REFUNDED")
    .map((s) => ({ id: s.id, label: s.number, date: s.saleDate, who: s.customerName, href: `/c/${slug}/pos/sales/${s.id}`, ...saleProfit(s) }));
  const offerRows: Row[] = offers
    .filter((o) => inPeriod(o.offerDate))
    .map((o) => {
      const cost = o.lines.reduce((s, l) => s + (l.productId && l.product?.type === "PRODUCT" ? Number(l.quantity) * (avg.get(l.productId) ?? 0) : 0), 0);
      return { id: o.id, label: o.number, date: o.offerDate, who: o.customerName, href: `/c/${slug}/offers/${o.id}`, ...profitOf(Number(o.totalHT), cost) };
    });

  // Products: units sold at the counter and on job cards, with revenue and cost.
  const products = new Map<string, { name: string; code: string; units: number; revenue: number; cost: number }>();
  const addProduct = (id: string, name: string, code: string, units: number, revenue: number, cost: number) => {
    const p = products.get(id) ?? { name, code, units: 0, revenue: 0, cost: 0 };
    p.units += units;
    p.revenue += revenue;
    p.cost += cost;
    products.set(id, p);
  };
  for (const s of sales.filter((x) => inPeriod(x.saleDate)))
    for (const l of s.lines) {
      const kept = l.quantity - l.refunded;
      if (kept > 0) addProduct(l.productId, l.name, l.code, kept, l.unitPriceHT * kept * (1 - s.discountPct / 100), l.unitCost * kept);
    }
  for (const j of jobs.filter((x) => x.status === "DONE" && x.completedAt && inPeriod(x.completedAt)))
    for (const l of j.lines)
      if (l.kind === "PART" && l.productId) addProduct(l.productId, l.title, "", l.quantity, l.billable || !j.offer ? l.lineTotal : 0, l.quantity * (l.unitCost || (avg.get(l.productId) ?? 0)));
  const productRows = [...products.entries()]
    .map(([id, p]) => ({ id, name: p.name, code: p.code, units: p.units, ...profitOf(p.revenue, p.cost) }))
    .sort((a, b) => b.profit - a.profit);

  const total = (rows: ProfitFigures[]) => profitOf(rows.reduce((s, r) => s + r.revenue, 0), rows.reduce((s, r) => s + r.cost, 0));
  return {
    labourCostPerHour: profile.labourCostPerHour,
    missingCosts: [...avg.values()].length === 0,
    jobs: { rows: jobRows, total: total(jobRows) },
    sales: { rows: saleRows, total: total(saleRows) },
    offers: { rows: offerRows, total: total(offerRows) },
    products: { rows: productRows, total: total(productRows) },
  };
}
