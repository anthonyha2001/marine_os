import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor, listProductsWithStock } from "@/lib/data/inventory";
import { round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";

// Point of sale reads, cached per company. Every POS action calls updateTag(posTag(companyId)).
export const posTag = (companyId: string) => `pos:${companyId}`;

async function loadRate(companyId: string) {
  "use cache";
  cacheTag(posTag(companyId));
  cacheLife("hours");
  const r = await prisma.exchangeRate.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: { setBy: { select: { name: true } } },
  });
  return r ? { id: r.id, lbpPerUsd: Number(r.lbpPerUsd), setAt: r.createdAt, setByName: r.setBy.name } : null;
}

/** The latest LBP rate for this company, or null if none was set yet. */
export async function getRate(slug: CompanySlug) {
  return loadRate(await companyIdFor(slug));
}

export type ShiftRow = Awaited<ReturnType<typeof loadShifts>>[number];

async function loadShifts(companyId: string) {
  "use cache";
  cacheTag(posTag(companyId));
  cacheLife("hours");
  const rows = await prisma.posShift.findMany({
    where: { companyId },
    include: { cashier: { select: { name: true } } },
    orderBy: { openedAt: "desc" },
    take: 500,
  });
  return rows.map((s) => ({
    id: s.id,
    number: s.number,
    cashierId: s.cashierId,
    cashierName: s.cashier.name,
    status: s.status as "OPEN" | "CLOSED",
    openedAt: s.openedAt,
    closedAt: s.closedAt,
    openingUsd: Number(s.openingUsd),
    openingLbp: Number(s.openingLbp),
    expectedUsd: s.expectedUsd === null ? null : Number(s.expectedUsd),
    expectedLbp: s.expectedLbp === null ? null : Number(s.expectedLbp),
    countedUsd: s.countedUsd === null ? null : Number(s.countedUsd),
    countedLbp: s.countedLbp === null ? null : Number(s.countedLbp),
    closeRate: s.closeRate === null ? null : Number(s.closeRate),
    notes: s.notes,
  }));
}

export async function listShifts(slug: CompanySlug) {
  return loadShifts(await companyIdFor(slug));
}

/** The shift this user has open at the till, if any. */
export async function openShiftFor(slug: CompanySlug, userId: string) {
  return (await listShifts(slug)).find((s) => s.status === "OPEN" && s.cashierId === userId) ?? null;
}

export type SaleRow = Awaited<ReturnType<typeof loadSales>>[number];

async function loadSales(companyId: string) {
  "use cache";
  cacheTag(posTag(companyId));
  cacheLife("hours");
  const rows = await prisma.posSale.findMany({
    where: { companyId },
    include: {
      cashier: { select: { name: true } },
      lines: { orderBy: { position: "asc" }, include: { refundLines: { select: { quantity: true } } } },
      refunds: { include: { cashier: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((s) => ({
    id: s.id,
    number: s.number,
    shiftId: s.shiftId,
    cashierId: s.cashierId,
    cashierName: s.cashier.name,
    saleDate: s.saleDate,
    createdAt: s.createdAt,
    customerId: s.customerId,
    customerName: s.customerName,
    customerAddress: s.customerAddress,
    customerTaxNumber: s.customerTaxNumber,
    subtotalHT: Number(s.subtotalHT),
    discountPct: Number(s.discountPct),
    discountHT: Number(s.discountHT),
    totalHT: Number(s.totalHT),
    vatAmount: Number(s.vatAmount),
    totalTTC: Number(s.totalTTC),
    rate: Number(s.rate),
    paidUsd: Number(s.paidUsd),
    paidLbp: Number(s.paidLbp),
    paidCard: Number(s.paidCard),
    changeUsd: Number(s.changeUsd),
    changeLbp: Number(s.changeLbp),
    status: s.status as "COMPLETED" | "PARTLY_REFUNDED" | "REFUNDED",
    lines: s.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      code: l.code,
      name: l.name,
      quantity: l.quantity,
      unitPriceHT: Number(l.unitPriceHT),
      lineTotalHT: Number(l.lineTotalHT),
      refunded: l.refundLines.reduce((n, r) => n + r.quantity, 0),
    })),
    refunds: s.refunds.map((r) => ({
      id: r.id,
      number: r.number,
      shiftId: r.shiftId,
      cashierName: r.cashier.name,
      date: r.date,
      createdAt: r.createdAt,
      reason: r.reason,
      totalHT: Number(r.totalHT),
      vatAmount: Number(r.vatAmount),
      totalTTC: Number(r.totalTTC),
      method: r.method as "CASH_USD" | "CASH_LBP" | "CARD",
      amountLbp: Number(r.amountLbp),
    })),
  }));
}

export async function listSales(slug: CompanySlug) {
  return loadSales(await companyIdFor(slug));
}

export async function getSale(slug: CompanySlug, id: string) {
  return (await listSales(slug)).find((s) => s.id === id) ?? null;
}

/** Products the till can sell, with this company's stock (searched in the browser). */
export async function posCatalogue(slug: CompanySlug) {
  return (await listProductsWithStock(slug))
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, code: p.code, name: p.name, priceHT: p.priceHT, barcodes: p.barcodes, stock: p.stock, imageUrl: p.imageUrl }));
}
export type PosProduct = Awaited<ReturnType<typeof posCatalogue>>[number];

/** Cash a shift's drawer should hold: opening float + cash kept from sales − cash refunds. */
export function expectedCash(shift: { id: string; openingUsd: number; openingLbp: number }, sales: SaleRow[]) {
  let usd = shift.openingUsd;
  let lbp = shift.openingLbp;
  for (const s of sales) {
    if (s.shiftId === shift.id) {
      usd += s.paidUsd - s.changeUsd;
      lbp += s.paidLbp - s.changeLbp;
    }
    for (const r of s.refunds) {
      if (r.shiftId !== shift.id) continue;
      if (r.method === "CASH_USD") usd -= r.totalTTC;
      if (r.method === "CASH_LBP") lbp -= r.amountLbp;
    }
  }
  return { usd: round2(usd), lbp: Math.round(lbp) };
}

/** Totals for a set of sales and refunds: per payment method, per cashier, best sellers. */
export function salesSummary(sales: SaleRow[], refunds: (SaleRow["refunds"][number] & { sale: SaleRow })[]) {
  const gross = round2(sales.reduce((s, x) => s + x.totalTTC, 0));
  const refunded = round2(refunds.reduce((s, r) => s + r.totalTTC, 0));
  const vat = round2(sales.reduce((s, x) => s + x.vatAmount, 0) - refunds.reduce((s, r) => s + r.vatAmount, 0));
  const methods = {
    usd: round2(sales.reduce((s, x) => s + x.paidUsd - x.changeUsd, 0) - refunds.filter((r) => r.method === "CASH_USD").reduce((s, r) => s + r.totalTTC, 0)),
    lbp: Math.round(sales.reduce((s, x) => s + x.paidLbp - x.changeLbp, 0) - refunds.filter((r) => r.method === "CASH_LBP").reduce((s, r) => s + r.amountLbp, 0)),
    card: round2(sales.reduce((s, x) => s + x.paidCard, 0) - refunds.filter((r) => r.method === "CARD").reduce((s, r) => s + r.totalTTC, 0)),
  };
  const byCashier = new Map<string, { name: string; count: number; total: number }>();
  for (const s of sales) {
    const c = byCashier.get(s.cashierId) ?? { name: s.cashierName, count: 0, total: 0 };
    c.count += 1;
    c.total = round2(c.total + s.totalTTC);
    byCashier.set(s.cashierId, c);
  }
  const byProduct = new Map<string, { code: string; name: string; quantity: number; amountHT: number }>();
  for (const s of sales)
    for (const l of s.lines) {
      const p = byProduct.get(l.productId) ?? { code: l.code, name: l.name, quantity: 0, amountHT: 0 };
      p.quantity += l.quantity - l.refunded;
      p.amountHT = round2(p.amountHT + (l.lineTotalHT * (1 - s.discountPct / 100) * (l.quantity - l.refunded)) / l.quantity);
      byProduct.set(l.productId, p);
    }
  return {
    count: sales.length,
    gross,
    refunded,
    net: round2(gross - refunded),
    vat,
    methods,
    cashiers: [...byCashier.values()].sort((a, b) => b.total - a.total),
    products: [...byProduct.values()].filter((p) => p.quantity > 0).sort((a, b) => b.quantity - a.quantity || b.amountHT - a.amountHT),
  };
}

/** Z report data for one shift: its sales, refunds given during it, and the cash position. */
export function shiftReport(shift: ShiftRow, sales: SaleRow[]) {
  const own = sales.filter((s) => s.shiftId === shift.id);
  const refunds = sales.flatMap((s) => s.refunds.filter((r) => r.shiftId === shift.id).map((r) => ({ ...r, sale: s })));
  const expected =
    shift.status === "CLOSED" && shift.expectedUsd !== null && shift.expectedLbp !== null ? { usd: shift.expectedUsd, lbp: shift.expectedLbp } : expectedCash(shift, sales);
  return { sales: own, refunds, summary: salesSummary(own, refunds), expected };
}
