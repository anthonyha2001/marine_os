"use server";

import { updateTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { businessToday } from "@/lib/dates";
import { companyIdFor, tags } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import { posTag } from "@/lib/data/pos";
import { averageCosts } from "@/lib/costing";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { nextNumber } from "@/lib/ledger/numbering";
import { postPosRefund, postPosSale, postShiftDifference } from "@/lib/ledger/posting";
import { VAT_RATE, round2 } from "@/lib/money";
import { canSetRate, hasPos, isRefundMethod, lbpUsdValue, maxDiscountFor, roundLbp, saleTotals, settle } from "@/lib/pos";

export type PosFormState = { error?: string; saved?: boolean };

const todayDate = () => new Date(`${businessToday()}T00:00:00Z`);
class UserError extends Error {}

async function requirePos(companySlug: string) {
  const ctx = await requireModule(companySlug, "sales");
  if (!hasPos(ctx.slug)) notFound();
  return { ...ctx, companyId: await companyIdFor(ctx.slug) };
}

function refresh(companyId: string, opts: { stock?: boolean; ledger?: boolean } = {}) {
  updateTag(posTag(companyId));
  if (opts.stock) updateTag(tags.stock(companyId));
  if (opts.ledger) updateTag(ledgerTag(companyId));
}

async function latestRate(companyId: string) {
  const r = await prisma.exchangeRate.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, select: { lbpPerUsd: true } });
  return r ? Number(r.lbpPerUsd) : null;
}

// ── Exchange rate ──

export async function setExchangeRate(companySlug: string, _prev: PosFormState, formData: FormData): Promise<PosFormState> {
  const { user, slug, companyId } = await requirePos(companySlug);
  if (!canSetRate(user.role)) return { error: "Only a manager or the accountant can change the rate." };
  const rate = Number(formData.get("lbpPerUsd"));
  if (!Number.isFinite(rate) || rate < 1000 || rate > 10_000_000) return { error: "Enter the rate in LBP for 1 USD, e.g. 89500." };
  await prisma.exchangeRate.create({ data: { companyId, lbpPerUsd: rate, setById: user.id } });
  refresh(companyId);
  redirect(`/c/${slug}/pos?rateSaved=1`);
}

// ── Shifts ──

const openSchema = z.object({
  openingUsd: z.coerce.number().min(0, "The float can't be negative"),
  openingLbp: z.coerce.number().min(0, "The float can't be negative"),
});

export async function openShift(companySlug: string, _prev: PosFormState, formData: FormData): Promise<PosFormState> {
  const { user, slug, companyId } = await requirePos(companySlug);
  const parsed = openSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await latestRate(companyId))) return { error: "Set today's exchange rate before opening the till." };
  try {
    await prisma.$transaction(async (tx) => {
      const open = await tx.posShift.count({ where: { companyId, cashierId: user.id, status: "OPEN" } });
      if (open) throw new UserError("You already have an open shift.");
      await tx.posShift.create({
        data: {
          companyId,
          number: await nextNumber(tx, companyId, "SH", todayDate().getUTCFullYear()),
          cashierId: user.id,
          openingUsd: round2(parsed.data.openingUsd),
          openingLbp: Math.round(parsed.data.openingLbp),
        },
      });
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  refresh(companyId);
  redirect(`/c/${slug}/pos`);
}

const closeSchema = z.object({
  countedUsd: z.coerce.number({ message: "Count the USD in the drawer" }).min(0),
  countedLbp: z.coerce.number({ message: "Count the LBP in the drawer" }).min(0),
  notes: z.string().trim().max(1000).optional().transform((v) => v || null),
});

/** Close a shift: record the counted cash; any difference is posted as over/short. */
export async function closeShift(companySlug: string, shiftId: string, _prev: PosFormState, formData: FormData): Promise<PosFormState> {
  const { user, slug, companyId } = await requirePos(companySlug);
  const parsed = closeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const shift = await prisma.posShift.findFirst({ where: { id: shiftId, companyId } });
  if (!shift || shift.status !== "OPEN") return { error: "This shift is already closed." };
  if (shift.cashierId !== user.id && user.role === "CASHIER") return { error: "Only the cashier who opened this shift can close it." };
  const rate = await latestRate(companyId);
  if (!rate) return { error: "Set the exchange rate first." };

  const expected = await shiftExpectedCash(shift.id, Number(shift.openingUsd), Number(shift.openingLbp));
  const countedUsd = round2(parsed.data.countedUsd);
  const countedLbp = Math.round(parsed.data.countedLbp);
  const usdDiff = round2(countedUsd - expected.usd);
  const lbpDiffValue = round2((countedLbp - expected.lbp) / rate);

  await prisma.$transaction(async (tx) => {
    const closed = await tx.posShift.updateMany({
      where: { id: shift.id, status: "OPEN" },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        expectedUsd: expected.usd,
        expectedLbp: expected.lbp,
        countedUsd,
        countedLbp,
        closeRate: rate,
        notes: parsed.data.notes,
      },
    });
    if (!closed.count) return;
    await postShiftDifference(tx, { id: shift.id, companyId, number: shift.number, date: todayDate(), usdDiff, lbpDiffValue, createdById: user.id });
  }, TRANSACTION_OPTIONS);
  refresh(companyId, { ledger: true });
  redirect(`/c/${slug}/pos/shifts/${shift.id}?closed=1`);
}

/** Cash the drawer should hold, straight from the database (never a cached list). */
async function shiftExpectedCash(shiftId: string, openingUsd: number, openingLbp: number) {
  const [sales, usdRefunds, lbpRefunds] = await Promise.all([
    prisma.posSale.aggregate({ where: { shiftId }, _sum: { paidUsd: true, changeUsd: true, paidLbp: true, changeLbp: true } }),
    prisma.posRefund.aggregate({ where: { shiftId, method: "CASH_USD" }, _sum: { totalTTC: true } }),
    prisma.posRefund.aggregate({ where: { shiftId, method: "CASH_LBP" }, _sum: { amountLbp: true } }),
  ]);
  const n = (v: unknown) => Number(v ?? 0);
  return {
    usd: round2(openingUsd + n(sales._sum.paidUsd) - n(sales._sum.changeUsd) - n(usdRefunds._sum.totalTTC)),
    lbp: Math.round(openingLbp + n(sales._sum.paidLbp) - n(sales._sum.changeLbp) - n(lbpRefunds._sum.amountLbp)),
  };
}

// ── Sales ──

const saleSchema = z.object({
  lines: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive().max(100000) })).min(1, "Scan at least one product"),
  discountPct: z.number().min(0).max(100),
  customerId: z.string().nullable().optional(),
  customerName: z.string().trim().max(200).optional(),
  customerTaxNumber: z.string().trim().max(100).optional(),
  paidUsd: z.number().min(0),
  paidLbp: z.number().min(0),
  paidCard: z.number().min(0),
  changeCurrency: z.enum(["USD", "LBP"]),
  rate: z.number().positive(),
});

export type CompleteSaleResult = { error?: string; saleId?: string; number?: string; changeUsd?: number; changeLbp?: number };

export async function completeSale(companySlug: string, payload: unknown): Promise<CompleteSaleResult> {
  const { user, companyId } = await requirePos(companySlug);
  const parsed = saleSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  if (data.discountPct > maxDiscountFor(user.role)) return { error: `A cashier can give at most ${maxDiscountFor(user.role)}% discount. Ask a manager.` };

  const [shift, rate, products, customer] = await Promise.all([
    prisma.posShift.findFirst({ where: { companyId, cashierId: user.id, status: "OPEN" }, select: { id: true } }),
    latestRate(companyId),
    prisma.product.findMany({ where: { id: { in: data.lines.map((l) => l.productId) }, type: "PRODUCT" }, select: { id: true, code: true, name: true, priceHT: true } }),
    data.customerId ? prisma.customer.findUnique({ where: { id: data.customerId }, select: { id: true, name: true, address: true, taxNumber: true } }) : null,
  ]);
  if (!shift) return { error: "Open a shift before selling." };
  if (!rate) return { error: "Set the exchange rate first." };
  if (Math.abs(rate - data.rate) > 0.001) return { error: "The exchange rate was just changed. Check the amounts and try again.", };

  const byId = new Map(products.map((p) => [p.id, p]));
  const costs = await averageCosts(companyId);
  if (data.lines.some((l) => !byId.has(l.productId))) return { error: "One of the products no longer exists. Remove it and scan again." };
  const lines = data.lines.map((l, position) => {
    const p = byId.get(l.productId)!;
    const unitPriceHT = Number(p.priceHT);
    return { position, productId: p.id, code: p.code, name: p.name, quantity: l.quantity, unitPriceHT, lineTotalHT: round2(unitPriceHT * l.quantity), unitCost: costs.get(p.id) ?? 0 };
  });
  const totals = saleTotals(lines, data.discountPct);
  const pay = settle({ totalTTC: totals.totalTTC, rate, paidUsd: data.paidUsd, paidLbp: data.paidLbp, paidCard: data.paidCard, changeCurrency: data.changeCurrency });
  if (pay.cardTooHigh) return { error: "The card amount can't be more than the total." };
  if (!pay.ok) return { error: "The payment doesn't cover the total yet." };

  const name = customer?.name ?? (data.customerName || "Walk-in customer");
  const date = todayDate();
  const sale = await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, companyId, "POS", date.getUTCFullYear(), 5);
    const created = await tx.posSale.create({
      select: { id: true },
      data: {
        companyId,
        number,
        shiftId: shift.id,
        cashierId: user.id,
        saleDate: date,
        customerId: customer?.id ?? null,
        customerName: name,
        customerAddress: customer?.address ?? null,
        customerTaxNumber: customer?.taxNumber ?? (data.customerTaxNumber || null),
        subtotalHT: totals.subtotalHT,
        discountPct: data.discountPct,
        discountHT: totals.discountHT,
        totalHT: totals.totalHT,
        vatAmount: totals.vatAmount,
        totalTTC: totals.totalTTC,
        rate,
        paidUsd: pay.paidUsd,
        paidLbp: pay.paidLbp,
        paidCard: pay.paidCard,
        changeUsd: pay.changeUsd,
        changeLbp: pay.changeLbp,
        lines: { create: lines },
        stockMovements: { create: lines.map((l) => ({ companyId, productId: l.productId, quantity: -l.quantity, type: "POS_SALE" })) },
      },
    });
    await postPosSale(tx, {
      id: created.id,
      companyId,
      number,
      date,
      customerId: customer?.id ?? null,
      customerName: name,
      totalHT: totals.totalHT,
      vatAmount: totals.vatAmount,
      totalTTC: totals.totalTTC,
      usdKept: round2(pay.paidUsd - pay.changeUsd),
      lbpValue: lbpUsdValue(totals.totalTTC, pay.paidUsd, pay.changeUsd, pay.paidCard),
      card: pay.paidCard,
      createdById: user.id,
    });
    return { id: created.id, number };
  }, TRANSACTION_OPTIONS);

  refresh(companyId, { stock: true, ledger: true });
  return { saleId: sale.id, number: sale.number, changeUsd: pay.changeUsd, changeLbp: pay.changeLbp };
}

const customerSchema = z.object({
  customerName: z.string().trim().min(2, "Enter the customer's name").max(200),
  customerAddress: z.string().trim().max(500).optional().transform((v) => v || null),
  customerTaxNumber: z.string().trim().max(100).optional().transform((v) => v || null),
});

/** Put the customer's details on a sale, for the A4 tax invoice. */
export async function updateSaleCustomer(companySlug: string, saleId: string, _prev: PosFormState, formData: FormData): Promise<PosFormState> {
  const { companyId } = await requirePos(companySlug);
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const updated = await prisma.posSale.updateMany({ where: { id: saleId, companyId }, data: parsed.data });
  if (!updated.count) return { error: "This sale no longer exists." };
  refresh(companyId);
  return { saved: true };
}

// ── Refunds ──

const refundSchema = z.object({
  lines: z.array(z.object({ saleLineId: z.string().min(1), quantity: z.number().int().min(0) })),
  method: z.string().refine(isRefundMethod, "Choose how the money is given back"),
  reason: z.string().trim().min(3, "Enter the reason for the return").max(500),
});

export async function refundSale(companySlug: string, saleId: string, _prev: PosFormState, formData: FormData): Promise<PosFormState> {
  const { user, slug, companyId } = await requirePos(companySlug);
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = refundSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const method = data.method as "CASH_USD" | "CASH_LBP" | "CARD";
  const wanted = data.lines.filter((l) => l.quantity > 0);
  if (!wanted.length) return { error: "Choose the quantity returned on at least one line." };

  const [shift, rate] = await Promise.all([
    prisma.posShift.findFirst({ where: { companyId, cashierId: user.id, status: "OPEN" }, select: { id: true } }),
    latestRate(companyId),
  ]);
  if (!shift) return { error: "Open a shift at the till to give a refund (the money comes out of your drawer)." };
  if (!rate) return { error: "Set the exchange rate first." };

  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.posSale.findFirst({
        where: { id: saleId, companyId },
        include: { lines: { include: { refundLines: { select: { quantity: true } } } }, refunds: { select: { totalTTC: true } } },
      });
      if (!sale) throw new UserError("This sale no longer exists.");
      const discount = Number(sale.discountPct) / 100;
      const refundLines = wanted.map((w) => {
        const line = sale.lines.find((l) => l.id === w.saleLineId);
        if (!line) throw new UserError("A line of this sale no longer exists.");
        const left = line.quantity - line.refundLines.reduce((n, r) => n + r.quantity, 0);
        if (w.quantity > left) throw new UserError(`Only ${left} × ${line.name} can still be returned.`);
        return { saleLineId: line.id, productId: line.productId, quantity: w.quantity, amountHT: round2(Number(line.unitPriceHT) * w.quantity * (1 - discount)) };
      });
      const totalHT = round2(refundLines.reduce((s, l) => s + l.amountHT, 0));
      const vatAmount = round2(totalHT * VAT_RATE);
      const already = round2(sale.refunds.reduce((s, r) => s + Number(r.totalTTC), 0));
      // Never give back more than was paid (rounding on the last return).
      const totalTTC = Math.min(round2(totalHT + vatAmount), round2(Number(sale.totalTTC) - already));
      const date = todayDate();
      const number = await nextNumber(tx, companyId, "RF", date.getUTCFullYear());
      const refund = await tx.posRefund.create({
        select: { id: true },
        data: {
          companyId,
          number,
          saleId: sale.id,
          shiftId: shift.id,
          cashierId: user.id,
          date,
          reason: data.reason,
          totalHT,
          vatAmount: round2(totalTTC - totalHT),
          totalTTC,
          method,
          rate,
          amountLbp: method === "CASH_LBP" ? roundLbp(totalTTC * rate) : 0,
          lines: { create: refundLines.map(({ saleLineId, quantity, amountHT }) => ({ saleLineId, quantity, amountHT })) },
          stockMovements: { create: refundLines.map((l) => ({ companyId, productId: l.productId, quantity: l.quantity, type: "POS_RETURN" })) },
        },
      });
      const soldQty = sale.lines.reduce((n, l) => n + l.quantity, 0);
      const returnedQty = sale.lines.reduce((n, l) => n + l.refundLines.reduce((m, r) => m + r.quantity, 0), 0) + refundLines.reduce((n, l) => n + l.quantity, 0);
      await tx.posSale.update({ where: { id: sale.id }, data: { status: returnedQty >= soldQty ? "REFUNDED" : "PARTLY_REFUNDED" } });
      await postPosRefund(tx, { id: refund.id, companyId, number, saleNumber: sale.number, date, method, totalHT, vatAmount: round2(totalTTC - totalHT), totalTTC, createdById: user.id });
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  refresh(companyId, { stock: true, ledger: true });
  redirect(`/c/${slug}/pos/sales/${saleId}?refunded=1`);
}
