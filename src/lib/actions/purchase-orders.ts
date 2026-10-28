"use server";

import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { poTag } from "@/lib/data/purchase-orders";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { purchaseTotals, round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";

export type PurchaseOrderFormState = { error?: string };

const NUMBER_PREFIX: Record<CompanySlug, string> = { "xpert-marine": "XM", "eliche-radice": "ER" };
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

const poSchema = z.object({
  supplierId: z.string().min(1, "Choose a supplier"),
  orderDate: date,
  expectedDate: z.union([date, z.literal("")]).optional().transform((v) => v || null),
  reference: text(200),
  terms: text(5000),
  notes: text(5000),
  status: z.enum(["DRAFT", "SENT"]),
  discount: z.number().min(0, "Discount can't be negative").default(0),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int("Quantities must be whole numbers").min(0, "Quantities can't be negative"),
        unitPriceHT: z.number().min(0, "Prices can't be negative"),
      }),
    )
    .max(1000)
    // Lines left at 0 (e.g. after loading a supplier's products) are dropped.
    .transform((items) => items.filter((i) => i.quantity > 0))
    .refine((items) => items.length > 0, "Enter a quantity for at least one product"),
});

async function nextPoNumber(tx: Tx, slug: CompanySlug, year: number) {
  const prefix = `${NUMBER_PREFIX[slug]}-PO-${year}-`;
  const last = await tx.purchaseOrder.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return prefix + String((last ? Number(last.number.slice(prefix.length)) : 0) + 1).padStart(4, "0");
}

/** Create (orderId = null) or update a purchase order of the company being viewed. */
export async function savePurchaseOrder(
  companySlug: string,
  orderId: string | null,
  _prev: PurchaseOrderFormState,
  formData: FormData,
): Promise<PurchaseOrderFormState> {
  const { user, slug } = await requireModule(companySlug, "purchases");
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = poSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const totals = purchaseTotals(data.items, data.discount);
  if (data.discount > totals.subtotalHT) return { error: "The discount is larger than the order total." };

  const companyId = await companyIdFor(slug);
  const existing = orderId
    ? await prisma.purchaseOrder.findFirst({ where: { id: orderId, companyId }, select: { id: true, status: true } })
    : null;
  if (orderId && !existing) return { error: "This purchase order no longer exists." };
  if (existing && (existing.status === "RECEIVED" || existing.status === "CANCELLED")) {
    return { error: "Received or cancelled purchase orders can't be changed." };
  }

  const fields = {
    supplierId: data.supplierId,
    orderDate: new Date(`${data.orderDate}T00:00:00Z`),
    expectedDate: data.expectedDate ? new Date(`${data.expectedDate}T00:00:00Z`) : null,
    reference: data.reference,
    terms: data.terms,
    notes: data.notes,
    status: data.status,
    ...totals,
  };
  const lines = data.items.map((i, position) => ({
    position,
    productId: i.productId,
    quantity: i.quantity,
    unitPriceHT: i.unitPriceHT,
    lineTotalHT: round2(i.quantity * i.unitPriceHT),
  }));

  let savedId: string;
  try {
    if (existing) {
      await prisma.purchaseOrder.update({ where: { id: existing.id }, data: { ...fields, lines: { deleteMany: {}, create: lines } } });
      savedId = existing.id;
    } else {
      savedId = await withNumberRetry(() =>
        prisma.$transaction(async (tx) => {
          const order = await tx.purchaseOrder.create({
            select: { id: true },
            data: {
              ...fields,
              companyId,
              number: await nextPoNumber(tx, slug, Number(data.orderDate.slice(0, 4))),
              createdById: user.id,
              lines: { create: lines },
            },
          });
          return order.id;
        }, TRANSACTION_OPTIONS),
      );
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { error: "The supplier or one of the products no longer exists." };
    }
    throw e;
  }

  updateTag(poTag(companyId));
  redirect(`/c/${slug}/purchase-orders/${savedId}?saved=1`);
}

async function withNumberRetry<T>(fn: () => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 3) continue;
      throw e;
    }
  }
}

/** Draft ↔ sent, or cancel. "Received" is only set by receiving the goods. */
export async function setPurchaseOrderStatus(companySlug: string, orderId: string, status: "DRAFT" | "SENT" | "CANCELLED") {
  const { slug } = await requireModule(companySlug, "purchases");
  if (!["DRAFT", "SENT", "CANCELLED"].includes(status)) return;
  const companyId = await companyIdFor(slug);
  await prisma.purchaseOrder.updateMany({
    where: { id: orderId, companyId, status: { in: ["DRAFT", "SENT", "CANCELLED"] } },
    data: { status },
  });
  updateTag(poTag(companyId));
}

/** Delete a purchase order that hasn't been received. */
export async function deletePurchaseOrder(companySlug: string, orderId: string): Promise<{ error?: string }> {
  const { slug } = await requireModule(companySlug, "purchases");
  const companyId = await companyIdFor(slug);
  const order = await prisma.purchaseOrder.findFirst({ where: { id: orderId, companyId }, select: { status: true } });
  if (!order) return { error: "This purchase order no longer exists." };
  if (order.status === "RECEIVED") return { error: "Received purchase orders are kept with their purchase, so they can't be deleted." };
  await prisma.purchaseOrder.delete({ where: { id: orderId } });
  updateTag(poTag(companyId));
  redirect(`/c/${slug}/purchase-orders`);
}
