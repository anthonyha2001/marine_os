"use server";

import { returnTarget } from "@/lib/return-to";
import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toRecycleBin } from "@/lib/recycle-bin";
import { deleteRefusal } from "@/lib/delete-rules";
import { requireModule } from "@/lib/auth";
import { companyIdFor, tags } from "@/lib/data/inventory";
import { poTag } from "@/lib/data/purchase-orders";
import { payablesTag } from "@/lib/data/accounting";
import { ledgerTag } from "@/lib/data/ledger";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { purchaseTotals, round2 } from "@/lib/money";
import { postPurchase } from "@/lib/ledger/posting";
import { recomputePurchaseCosts } from "@/lib/costing";

export type PurchaseFormState = { error?: string };

class OrderNotReceivable extends Error {}

const purchaseSchema = z.object({
  supplierId: z.string().min(1, "Choose a supplier"),
  invoiceNumber: z.string().trim().min(1, "Enter the supplier's invoice number").max(100),
  reference: z.string().trim().max(200).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the invoice date"),
  // When the supplier must be paid; empty = due on the invoice date.
  dueDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  discount: z.number().min(0, "Discount can't be negative").default(0),
  notes: z.string().trim().max(2000).optional(),
  purchaseOrderId: z.string().optional(), // set when receiving a purchase order
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int("Quantities must be whole numbers").positive("Quantities must be at least 1"),
        unitPriceHT: z.number().min(0, "Prices can't be negative"),
      }),
    )
    .min(1, "Add at least one product"),
});

/**
 * Save a purchase for the company the user is working in and add the quantities to its stock.
 * The browser sends the table as JSON; totals are always recalculated here.
 */
export async function createPurchase(
  companySlug: string,
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const { user, slug } = await requireModule(companySlug, "purchases");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = purchaseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const totals = purchaseTotals(data.items, data.discount);
  if (data.discount > totals.subtotalHT) return { error: "The discount is larger than the purchase total." };

  const companyId = await companyIdFor(slug);
  let purchaseId: string;
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId }, select: { name: true } });
    if (!supplier) return { error: "That supplier no longer exists." };
    const ledgerFields = {
      companyId,
      invoiceNumber: data.invoiceNumber,
      purchaseDate: new Date(`${data.purchaseDate}T00:00:00Z`),
      supplierId: data.supplierId,
      supplierName: supplier.name,
      totalHT: totals.totalHT,
      vatAmount: totals.vatAmount,
      totalTTC: totals.totalTTC,
      createdById: user.id,
    };
    const purchaseData = {
        companyId,
        supplierId: data.supplierId,
        invoiceNumber: data.invoiceNumber,
        reference: data.reference || null,
        purchaseDate: new Date(`${data.purchaseDate}T00:00:00Z`),
        dueDate: data.dueDate ? new Date(`${data.dueDate}T00:00:00Z`) : null,
        notes: data.notes || null,
        createdById: user.id,
        ...totals,
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPriceHT: i.unitPriceHT,
            lineTotalHT: round2(i.quantity * i.unitPriceHT),
          })),
        },
        stockMovements: {
          create: data.items.map((i) => ({
            companyId,
            productId: i.productId,
            quantity: i.quantity,
            type: "PURCHASE",
          })),
        },
    };
    if (data.purchaseOrderId) {
      // Receiving a purchase order: create the purchase and mark the order received together.
      // The status check inside the transaction stops the same order being received twice.
      const orderId = data.purchaseOrderId;
      purchaseId = await prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.create({ select: { id: true }, data: purchaseData });
        await postPurchase(tx, { id: purchase.id, ...ledgerFields });
        await recomputePurchaseCosts(tx, purchase.id);
        const updated = await tx.purchaseOrder.updateMany({
          where: { id: orderId, companyId, status: { in: ["DRAFT", "SENT"] }, purchaseId: null },
          data: { status: "RECEIVED", purchaseId: purchase.id },
        });
        if (updated.count !== 1) throw new OrderNotReceivable();
        return purchase.id;
      }, TRANSACTION_OPTIONS);
    } else {
      // The purchase and its journal entry are saved together.
      purchaseId = await prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.create({ select: { id: true }, data: purchaseData });
        await postPurchase(tx, { id: purchase.id, ...ledgerFields });
        await recomputePurchaseCosts(tx, purchase.id);
        return purchase.id;
      }, TRANSACTION_OPTIONS);
    }
  } catch (e) {
    if (e instanceof OrderNotReceivable) {
      return { error: "This purchase order was already received or cancelled, so no stock was added." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { error: "The supplier or one of the products no longer exists." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Invoice ${data.invoiceNumber} from this supplier is already recorded for this company.` };
    }
    throw e;
  }

  updateTag(tags.purchases(companyId));
  updateTag(tags.stock(companyId));
  updateTag(payablesTag(companyId));
  updateTag(ledgerTag(companyId));
  if (data.purchaseOrderId) updateTag(poTag(companyId));
  redirect(returnTarget(slug, formData, "Saved and added to stock.") ?? `/c/${slug}/purchases/${purchaseId}`);
}

export type LandedCostState = { error?: string };

/** Add freight / customs / clearing to a purchase; item costs are recalculated. */
export async function addLandedCost(companySlug: string, purchaseId: string, _prev: LandedCostState, formData: FormData): Promise<LandedCostState> {
  const { slug } = await requireModule(companySlug, "purchases");
  const companyId = await companyIdFor(slug);
  const description = String(formData.get("description") ?? "").trim().slice(0, 200);
  const amount = round2(Number(formData.get("amount")));
  if (description.length < 2) return { error: "Describe the cost (e.g. Sea freight, Customs duty)." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount excl. VAT." };
  const purchase = await prisma.purchase.findFirst({ where: { id: purchaseId, companyId }, select: { id: true } });
  if (!purchase) return { error: "This purchase no longer exists." };
  await prisma.$transaction(async (tx) => {
    await tx.landedCost.create({ data: { purchaseId, description, amount } });
    await recomputePurchaseCosts(tx, purchaseId);
  }, TRANSACTION_OPTIONS);
  updateTag(tags.purchases(companyId));
  redirect(`/c/${slug}/purchases/${purchaseId}?landed=1`);
}

export async function deleteLandedCost(companySlug: string, purchaseId: string, landedCostId: string): Promise<{ error?: string }> {
  const { user, slug } = await requireModule(companySlug, "purchases");
  const refused = deleteRefusal(user, "posted");
  if (refused) return { error: refused };
  const companyId = await companyIdFor(slug);
  const found = await prisma.landedCost.findFirst({
    where: { id: landedCostId, purchase: { id: purchaseId, companyId } },
    select: { id: true, description: true, purchase: { select: { invoiceNumber: true } } },
  });
  if (!found) return { error: "This cost no longer exists." };
  await prisma.$transaction(async (tx) => {
    const label = `Landed cost · ${found.description} · purchase ${found.purchase.invoiceNumber}`;
    await toRecycleBin(tx, { model: "LandedCost", id: landedCostId, companyId, label, deletedByName: user.name });
    await tx.landedCost.delete({ where: { id: landedCostId } });
    await recomputePurchaseCosts(tx, purchaseId);
  }, TRANSACTION_OPTIONS);
  updateTag(tags.purchases(companyId));
  return {};
}
