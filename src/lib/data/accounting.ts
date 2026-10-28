import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import { round2 } from "@/lib/money";
import type { PaymentMethod } from "@/lib/accounting";
import type { CompanySlug } from "@/lib/permissions";

// Supplier bills (received purchases) and the payments made against them.
// Cached; purchases and payments call updateTag(payablesTag(companyId)).
export const payablesTag = (companyId: string) => `payables:${companyId}`;

async function loadBills(companyId: string) {
  "use cache";
  cacheTag(payablesTag(companyId));
  cacheLife("hours");
  const purchases = await prisma.purchase.findMany({
    where: { companyId },
    select: {
      id: true,
      invoiceNumber: true,
      purchaseDate: true,
      dueDate: true,
      totalTTC: true,
      supplier: { select: { id: true, name: true } },
      purchaseOrder: { select: { id: true, number: true } },
      payments: { select: { amount: true } },
    },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });
  return purchases.map((p) => {
    const total = Number(p.totalTTC);
    const paid = round2(p.payments.reduce((s, x) => s + Number(x.amount), 0));
    return {
      id: p.id,
      invoiceNumber: p.invoiceNumber,
      purchaseDate: p.purchaseDate,
      // Bills without a due date are due on the invoice date.
      dueDate: p.dueDate ?? p.purchaseDate,
      supplierId: p.supplier.id,
      supplierName: p.supplier.name,
      purchaseOrder: p.purchaseOrder,
      total,
      paid,
      balance: round2(total - paid),
    };
  });
}

export async function listBills(slug: CompanySlug) {
  return loadBills(await companyIdFor(slug));
}

async function loadPayments(companyId: string, purchaseId: string) {
  "use cache";
  cacheTag(payablesTag(companyId));
  cacheLife("hours");
  const payments = await prisma.supplierPayment.findMany({
    where: { companyId, purchaseId },
    include: { createdBy: { select: { name: true } } },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
  });
  return payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    paidAt: p.paidAt,
    method: p.method as PaymentMethod,
    reference: p.reference,
    notes: p.notes,
    createdByName: p.createdBy.name,
  }));
}

/** Payments made against one purchase of this company. */
export async function listPurchasePayments(slug: CompanySlug, purchaseId: string) {
  return loadPayments(await companyIdFor(slug), purchaseId);
}
