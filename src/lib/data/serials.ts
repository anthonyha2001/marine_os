import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import type { CompanySlug } from "@/lib/permissions";

// Serial-numbered units (engines, outboards…), per company. Actions call updateTag(serialsTag(companyId)).
export const serialsTag = (companyId: string) => `serials:${companyId}`;

export const SERIAL_STATUS = { IN_STOCK: "In stock", SOLD: "Sold", RETURNED: "Returned", SCRAPPED: "Scrapped" } as const;
export type SerialStatus = keyof typeof SERIAL_STATUS;

async function loadSerials(companyId: string) {
  "use cache";
  cacheTag(serialsTag(companyId));
  cacheLife("hours");
  const rows = await prisma.productSerial.findMany({
    where: { companyId },
    include: {
      product: { select: { id: true, code: true, name: true } },
      purchase: { select: { id: true, invoiceNumber: true, purchaseDate: true, supplier: { select: { name: true } } } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  const vesselIds = [...new Set(rows.map((r) => r.vesselId).filter(Boolean))] as string[];
  const vessels = vesselIds.length ? await prisma.vessel.findMany({ where: { id: { in: vesselIds } }, select: { id: true, name: true } }) : [];
  const vesselName = new Map(vessels.map((v) => [v.id, v.name]));
  return rows.map((r) => ({
    id: r.id,
    serialNumber: r.serialNumber,
    status: r.status as SerialStatus,
    product: r.product,
    purchase: r.purchase ? { id: r.purchase.id, invoiceNumber: r.purchase.invoiceNumber, date: r.purchase.purchaseDate, supplier: r.purchase.supplier.name } : null,
    customerName: r.customer?.name ?? r.customerName,
    customerId: r.customerId,
    vessel: r.vesselId ? { id: r.vesselId, name: vesselName.get(r.vesselId) ?? "—" } : null,
    soldAt: r.soldAt,
    soldRef: r.soldRef,
    notes: r.notes,
  }));
}

export async function listSerials(slug: CompanySlug) {
  return loadSerials(await companyIdFor(slug));
}
export type SerialRow = Awaited<ReturnType<typeof loadSerials>>[number];
