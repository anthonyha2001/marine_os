"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toRecycleBin } from "@/lib/recycle-bin";
import { deleteRefusal } from "@/lib/delete-rules";
import { requireModule } from "@/lib/auth";
import { businessToday } from "@/lib/dates";
import { companyIdFor, tags } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import { stockOpsTag } from "@/lib/data/stock-ops";
import { averageCosts } from "@/lib/costing";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { nextNumber } from "@/lib/ledger/numbering";
import { postTransfer, removeEntries } from "@/lib/ledger/posting";
import { round2 } from "@/lib/money";
import { isCompanySlug } from "@/lib/permissions";

export type StockFormState = { error?: string };
const today = () => new Date(`${businessToday()}T00:00:00Z`);
class UserError extends Error {}

async function ctx(companySlug: string) {
  const c = await requireModule(companySlug, "inventory");
  return { ...c, companyId: await companyIdFor(c.slug) };
}

async function stockOf(companyId: string, productIds?: string[]) {
  const rows = await prisma.stockMovement.groupBy({
    by: ["productId"],
    where: { companyId, ...(productIds ? { productId: { in: productIds } } : {}) },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

// ── Stock counts ──

/** Start a count: one line per active product with the quantity the system expects. */
export async function startStockCount(companySlug: string, _prev: StockFormState, formData: FormData): Promise<StockFormState> {
  const { user, slug, companyId } = await ctx(companySlug);
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000) || null;
  const filter = String(formData.get("filter") ?? "").trim().toLowerCase();
  const products = await prisma.product.findMany({ where: { type: "PRODUCT", active: true }, select: { id: true, name: true, code: true, supplier: { select: { name: true } } } });
  const chosen = filter
    ? products.filter((p) => p.name.toLowerCase().includes(filter) || p.code.startsWith(filter) || (p.supplier?.name ?? "").toLowerCase().includes(filter))
    : products;
  if (!chosen.length) return { error: filter ? "No product matches this filter." : "There are no products to count." };
  const stock = await stockOf(companyId);
  const date = today();
  const id = await prisma.$transaction(async (tx) => {
    const count = await tx.stockCount.create({
      select: { id: true },
      data: {
        companyId,
        number: await nextNumber(tx, companyId, "SC", date.getUTCFullYear()),
        countDate: date,
        notes,
        createdById: user.id,
        lines: { create: chosen.map((p) => ({ productId: p.id, expected: stock.get(p.id) ?? 0 })) },
      },
    });
    return count.id;
  }, TRANSACTION_OPTIONS);
  updateTag(stockOpsTag);
  redirect(`/c/${slug}/inventory/counts/${id}`);
}

const countLinesSchema = z.array(z.object({ id: z.string().min(1), counted: z.number().int().min(0).nullable() }));

export async function saveStockCount(companySlug: string, countId: string, _prev: StockFormState, formData: FormData): Promise<StockFormState> {
  const { slug, companyId } = await ctx(companySlug);
  let lines: z.infer<typeof countLinesSchema>;
  try {
    const parsed = countLinesSchema.safeParse(JSON.parse(String(formData.get("payload") ?? "")));
    if (!parsed.success) return { error: "Quantities must be whole numbers, 0 or more." };
    lines = parsed.data;
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const count = await prisma.stockCount.findFirst({ where: { id: countId, companyId }, select: { status: true } });
  if (!count) return { error: "This count no longer exists." };
  if (count.status !== "DRAFT") return { error: "This count is already posted." };
  await prisma.$transaction(async (tx) => {
    for (const l of lines) await tx.stockCountLine.updateMany({ where: { id: l.id, countId }, data: { counted: l.counted } });
  }, TRANSACTION_OPTIONS);
  updateTag(stockOpsTag);
  redirect(`/c/${slug}/inventory/counts/${countId}?saved=1`);
}

/**
 * Post a count: each counted product is adjusted to the counted quantity (against the stock
 * right now, so sales made during the count are not lost). Lines left empty are skipped.
 */
export async function postStockCount(companySlug: string, countId: string): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  try {
    await prisma.$transaction(async (tx) => {
      const count = await tx.stockCount.findFirst({ where: { id: countId, companyId }, include: { lines: { where: { counted: { not: null } } } } });
      if (!count) throw new UserError("This count no longer exists.");
      if (count.status !== "DRAFT") throw new UserError("This count is already posted.");
      if (!count.lines.length) throw new UserError("Enter at least one counted quantity, then save.");
      const rows = await tx.stockMovement.groupBy({ by: ["productId"], where: { companyId, productId: { in: count.lines.map((l) => l.productId) } }, _sum: { quantity: true } });
      const now = new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
      const moves = count.lines.map((l) => ({ productId: l.productId, quantity: (l.counted ?? 0) - (now.get(l.productId) ?? 0) })).filter((m) => m.quantity !== 0);
      if (moves.length) await tx.stockMovement.createMany({ data: moves.map((m) => ({ companyId, productId: m.productId, quantity: m.quantity, type: "COUNT", stockCountId: countId })) });
      await tx.stockCount.update({ where: { id: countId }, data: { status: "POSTED", postedAt: new Date() } });
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  updateTag(stockOpsTag);
  updateTag(tags.stock(companyId));
  return {};
}

export async function deleteStockCount(companySlug: string, countId: string): Promise<{ error?: string }> {
  const { user, slug, companyId } = await ctx(companySlug);
  const count = await prisma.stockCount.findFirst({ where: { id: countId, companyId }, select: { status: true, number: true } });
  if (!count) return { error: "This count no longer exists." };
  if (count.status !== "DRAFT") return { error: "A posted count can't be deleted." };
  const refused = deleteRefusal(user, "draft");
  if (refused) return { error: refused };
  await prisma.$transaction(async (tx) => {
    await toRecycleBin(tx, { model: "StockCount", id: countId, companyId, label: `Stock count ${count.number}`, deletedByName: user.name });
    await tx.stockCount.delete({ where: { id: countId } });
  });
  updateTag(stockOpsTag);
  redirect(`/c/${slug}/inventory/counts`);
}

// ── Transfers between the two companies ──

const transferSchema = z.object({
  toCompany: z.string().refine(isCompanySlug, "Choose the company receiving the goods"),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive("Quantities must be whole numbers above 0") })).min(1, "Add at least one product"),
});

/** Send goods to the sister company: stock leaves now, arrives when they receive it. */
export async function sendTransfer(companySlug: string, _prev: StockFormState, formData: FormData): Promise<StockFormState> {
  const { user, slug, companyId } = await ctx(companySlug);
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  if (data.toCompany === slug) return { error: "Choose the other company." };
  const to = await prisma.company.findUnique({ where: { slug: data.toCompany }, select: { id: true, name: true } });
  if (!to) return { error: "That company doesn't exist." };
  const ids = [...new Set(data.lines.map((l) => l.productId))];
  if (ids.length !== data.lines.length) return { error: "Each product can appear only once." };
  const [stock, cost] = await Promise.all([stockOf(companyId, ids), averageCosts(companyId)]);
  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const name = new Map(products.map((p) => [p.id, p.name]));
  for (const l of data.lines) {
    if ((stock.get(l.productId) ?? 0) < l.quantity) return { error: `Only ${stock.get(l.productId) ?? 0} × ${name.get(l.productId) ?? "product"} in stock.` };
  }
  const lines = data.lines.map((l) => {
    const unitCost = round2(cost.get(l.productId) ?? 0);
    return { productId: l.productId, quantity: l.quantity, unitCost, lineTotal: round2(unitCost * l.quantity) };
  });
  const totalCost = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const date = today();

  await prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.create({
      select: { id: true, number: true },
      data: {
        number: await nextNumber(tx, companyId, "TF", date.getUTCFullYear()),
        fromCompanyId: companyId,
        toCompanyId: to.id,
        sentDate: date,
        notes: data.notes || null,
        totalCost,
        createdById: user.id,
        lines: { create: lines },
      },
    });
    await tx.stockMovement.createMany({ data: lines.map((l) => ({ companyId, productId: l.productId, quantity: -l.quantity, type: "TRANSFER_OUT", transferId: transfer.id })) });
    await postTransfer(tx, { id: transfer.id, companyId, number: transfer.number, date, direction: "OUT", otherCompany: to.name, amount: totalCost, createdById: user.id });
  }, TRANSACTION_OPTIONS);
  updateTag(stockOpsTag);
  updateTag(tags.stock(companyId));
  updateTag(ledgerTag(companyId));
  redirect(`/c/${slug}/inventory/transfers?sent=1`);
}

/** The receiving company confirms the goods arrived: stock comes in on their side. */
export async function receiveTransfer(companySlug: string, transferId: string): Promise<{ error?: string }> {
  const { user, companyId } = await ctx(companySlug);
  try {
    await prisma.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findFirst({ where: { id: transferId, toCompanyId: companyId }, include: { lines: true, fromCompany: { select: { name: true } } } });
      if (!t) throw new UserError("This transfer isn't addressed to this company.");
      if (t.status !== "SENT") throw new UserError(t.status === "RECEIVED" ? "Already received." : "This transfer was cancelled.");
      const date = today();
      await tx.stockTransfer.update({ where: { id: t.id }, data: { status: "RECEIVED", receivedDate: date, receivedById: user.id } });
      await tx.stockMovement.createMany({ data: t.lines.map((l) => ({ companyId, productId: l.productId, quantity: l.quantity, type: "TRANSFER_IN", transferId: t.id })) });
      await postTransfer(tx, { id: t.id, companyId, number: t.number, date, direction: "IN", otherCompany: t.fromCompany.name, amount: Number(t.totalCost), createdById: user.id });
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  updateTag(stockOpsTag);
  updateTag(tags.stock(companyId));
  updateTag(ledgerTag(companyId));
  return {};
}

/** The sender cancels a transfer not yet received: the goods and the accounting come back. */
export async function cancelTransfer(companySlug: string, transferId: string): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  try {
    await prisma.$transaction(async (tx) => {
      const t = await tx.stockTransfer.findFirst({ where: { id: transferId, fromCompanyId: companyId }, select: { id: true, status: true } });
      if (!t) throw new UserError("Only the company that sent it can cancel a transfer.");
      if (t.status !== "SENT") throw new UserError(t.status === "RECEIVED" ? "It was already received; send the goods back with a new transfer." : "Already cancelled.");
      await tx.stockMovement.deleteMany({ where: { transferId: t.id } });
      await removeEntries(tx, "TRANSFER_OUT", t.id);
      await tx.stockTransfer.update({ where: { id: t.id }, data: { status: "CANCELLED" } });
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  updateTag(stockOpsTag);
  updateTag(tags.stock(companyId));
  updateTag(ledgerTag(companyId));
  return {};
}
