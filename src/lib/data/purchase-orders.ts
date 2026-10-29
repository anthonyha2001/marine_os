import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import type { CompanySlug } from "@/lib/permissions";
import { DATA_TAG } from "@/lib/cache-tag";

export const PO_STATUSES = {
  DRAFT: "Draft",
  SENT: "Sent",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
} as const;
export type PoStatus = keyof typeof PO_STATUSES;

export const poTag = (companyId: string) => `purchaseOrders:${companyId}`;

async function loadPurchaseOrders(companyId: string) {
  "use cache";
  cacheTag(DATA_TAG, poTag(companyId));
  cacheLife("hours");
  const orders = await prisma.purchaseOrder.findMany({
    where: { companyId },
    select: {
      id: true,
      number: true,
      orderDate: true,
      expectedDate: true,
      status: true,
      reference: true,
      totalTTC: true,
      purchaseId: true,
      supplier: { select: { name: true } },
      _count: { select: { lines: true } },
    },
    orderBy: [{ orderDate: "desc" }, { number: "desc" }],
  });
  return orders.map((o) => ({
    id: o.id,
    number: o.number,
    orderDate: o.orderDate,
    expectedDate: o.expectedDate,
    status: o.status as PoStatus,
    reference: o.reference,
    totalTTC: Number(o.totalTTC),
    purchaseId: o.purchaseId,
    supplierName: o.supplier.name,
    lineCount: o._count.lines,
  }));
}

export async function listPurchaseOrders(slug: CompanySlug) {
  return loadPurchaseOrders(await companyIdFor(slug));
}

export type PurchaseOrderDetail = NonNullable<Awaited<ReturnType<typeof loadPurchaseOrder>>>;

async function loadPurchaseOrder(companyId: string, id: string) {
  "use cache";
  cacheTag(DATA_TAG, poTag(companyId));
  cacheLife("hours");
  const o = await prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      createdBy: { select: { name: true, email: true } },
      lines: { orderBy: { position: "asc" }, include: { product: { select: { code: true, name: true } } } },
    },
  });
  if (!o) return null;
  return {
    id: o.id,
    number: o.number,
    supplierId: o.supplierId,
    supplier: {
      name: o.supplier.name,
      accountNumber: o.supplier.accountNumber,
      phone: o.supplier.phone,
      email: o.supplier.email,
      address: o.supplier.address,
    },
    orderDate: o.orderDate,
    expectedDate: o.expectedDate,
    status: o.status as PoStatus,
    reference: o.reference,
    terms: o.terms,
    notes: o.notes,
    subtotalHT: Number(o.subtotalHT),
    discount: Number(o.discount),
    totalHT: Number(o.totalHT),
    vatAmount: Number(o.vatAmount),
    totalTTC: Number(o.totalTTC),
    purchaseId: o.purchaseId,
    createdByName: o.createdBy.name,
    createdByEmail: o.createdBy.email,
    lines: o.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      code: l.product.code,
      name: l.product.name,
      quantity: l.quantity,
      unitPriceHT: Number(l.unitPriceHT),
      lineTotalHT: Number(l.lineTotalHT),
    })),
  };
}

/** A purchase order, only if it belongs to this company. */
export async function getPurchaseOrder(slug: CompanySlug, id: string) {
  return loadPurchaseOrder(await companyIdFor(slug), id);
}
