import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import type { CompanySlug } from "@/lib/permissions";

// Stock counts (per company) and transfers between the two companies.
export const stockOpsTag = "stock-ops";

async function loadCounts(companyId: string) {
  "use cache";
  cacheTag(stockOpsTag);
  cacheLife("hours");
  const rows = await prisma.stockCount.findMany({
    where: { companyId },
    include: {
      createdBy: { select: { name: true } },
      lines: { include: { product: { select: { code: true, name: true, priceHT: true } } }, orderBy: { product: { name: "asc" } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((c) => ({
    id: c.id,
    number: c.number,
    countDate: c.countDate,
    status: c.status as "DRAFT" | "POSTED",
    notes: c.notes,
    createdByName: c.createdBy.name,
    postedAt: c.postedAt,
    lines: c.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      code: l.product.code,
      name: l.product.name,
      priceHT: Number(l.product.priceHT),
      expected: l.expected,
      counted: l.counted,
    })),
  }));
}

export async function listStockCounts(slug: CompanySlug) {
  return loadCounts(await companyIdFor(slug));
}
export type StockCountRow = Awaited<ReturnType<typeof loadCounts>>[number];

async function loadTransfers() {
  "use cache";
  cacheTag(stockOpsTag);
  cacheLife("hours");
  const rows = await prisma.stockTransfer.findMany({
    include: {
      fromCompany: { select: { slug: true, name: true } },
      toCompany: { select: { slug: true, name: true } },
      createdBy: { select: { name: true } },
      receivedBy: { select: { name: true } },
      lines: { include: { product: { select: { code: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((t) => ({
    id: t.id,
    number: t.number,
    from: t.fromCompany,
    to: t.toCompany,
    status: t.status as "SENT" | "RECEIVED" | "CANCELLED",
    sentDate: t.sentDate,
    receivedDate: t.receivedDate,
    notes: t.notes,
    totalCost: Number(t.totalCost),
    createdByName: t.createdBy.name,
    receivedByName: t.receivedBy?.name ?? null,
    lines: t.lines.map((l) => ({ id: l.id, productId: l.productId, code: l.product.code, name: l.product.name, quantity: l.quantity, unitCost: Number(l.unitCost), lineTotal: Number(l.lineTotal) })),
  }));
}

/** Transfers this company sent or received. */
export async function listTransfers(slug: CompanySlug) {
  return (await loadTransfers()).filter((t) => t.from.slug === slug || t.to.slug === slug);
}
export type TransferRow = Awaited<ReturnType<typeof loadTransfers>>[number];
