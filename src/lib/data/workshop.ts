import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import { round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";

// Job cards and warranties, cached per company. Actions call updateTag(workshopTag(companyId)).
export const workshopTag = (companyId: string) => `workshop:${companyId}`;

export const JOB_STATUS = { OPEN: "Open", IN_PROGRESS: "In progress", DONE: "Done", CANCELLED: "Cancelled" } as const;
export type JobStatus = keyof typeof JOB_STATUS;
export const JOB_TONE = { OPEN: "blue", IN_PROGRESS: "amber", DONE: "green", CANCELLED: "gray" } as const;

async function loadJobCards(companyId: string) {
  "use cache";
  cacheTag(workshopTag(companyId));
  cacheLife("hours");
  const rows = await prisma.jobCard.findMany({
    where: { companyId },
    include: {
      vessel: { select: { id: true, name: true } },
      offer: { select: { id: true, number: true, status: true } },
      lines: { orderBy: { position: "asc" }, include: { invoice: { select: { id: true, number: true, status: true } } } },
      invoices: { select: { id: true, number: true, status: true, totalTTC: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ openedAt: "desc" }, { number: "desc" }],
  });
  return rows.map((j) => {
    const lines = j.lines.map((l) => ({
      id: l.id,
      kind: l.kind as "PART" | "LABOR" | "SERVICE",
      productId: l.productId,
      title: l.title,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
      billable: l.billable,
      invoice: l.invoice && l.invoice.status !== "CANCELLED" ? { id: l.invoice.id, number: l.invoice.number } : null,
    }));
    const toInvoice = lines.filter((l) => l.billable && !l.invoice);
    return {
      id: j.id,
      number: j.number,
      vessel: j.vessel,
      customerId: j.customerId,
      customerName: j.customerName,
      offer: j.offer,
      status: j.status as JobStatus,
      complaint: j.complaint,
      workDone: j.workDone,
      technician: j.technician,
      engineHours: j.engineHours,
      openedAt: j.openedAt,
      dueDate: j.dueDate,
      completedAt: j.completedAt,
      applyVat: j.applyVat,
      createdByName: j.createdBy.name,
      lines,
      invoices: j.invoices.filter((i) => i.status !== "CANCELLED").map((i) => ({ id: i.id, number: i.number, totalTTC: Number(i.totalTTC) })),
      totalHT: round2(lines.reduce((s, l) => s + l.lineTotal, 0)),
      toInvoiceHT: round2(toInvoice.reduce((s, l) => s + l.lineTotal, 0)),
    };
  });
}

export async function listJobCards(slug: CompanySlug) {
  return loadJobCards(await companyIdFor(slug));
}
export type JobCardRow = Awaited<ReturnType<typeof loadJobCards>>[number];

export async function getJobCard(slug: CompanySlug, id: string) {
  return (await listJobCards(slug)).find((j) => j.id === id) ?? null;
}

async function loadWarranties(companyId: string) {
  "use cache";
  cacheTag(workshopTag(companyId));
  cacheLife("hours");
  const rows = await prisma.warranty.findMany({
    where: { companyId },
    include: { vessel: { select: { id: true, name: true } }, claims: { orderBy: { date: "desc" }, include: { jobCard: { select: { id: true, number: true } } } } },
    orderBy: [{ endDate: "asc" }],
  });
  return rows.map((w) => ({
    id: w.id,
    number: w.number,
    customerId: w.customerId,
    customerName: w.customerName,
    vessel: w.vessel,
    productId: w.productId,
    item: w.item,
    serialNumber: w.serialNumber,
    startDate: w.startDate,
    endDate: w.endDate,
    terms: w.terms,
    sourceType: w.sourceType,
    sourceId: w.sourceId,
    sourceLabel: w.sourceLabel,
    status: w.status as "ACTIVE" | "VOID",
    claims: w.claims.map((c) => ({ id: c.id, date: c.date, description: c.description, status: c.status as "OPEN" | "ACCEPTED" | "REJECTED" | "RESOLVED", resolution: c.resolution, jobCard: c.jobCard })),
  }));
}

export async function listWarranties(slug: CompanySlug) {
  return loadWarranties(await companyIdFor(slug));
}
export type WarrantyRow = Awaited<ReturnType<typeof loadWarranties>>[number];

/** Covered / expiring within 30 days / expired, from today's date. */
export function warrantyState(w: { endDate: Date; startDate: Date; status: string }, todayIso: string) {
  if (w.status === "VOID") return "VOID" as const;
  const end = w.endDate.toISOString().slice(0, 10);
  if (end < todayIso) return "EXPIRED" as const;
  const soon = new Date(`${todayIso}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 30);
  return end <= soon.toISOString().slice(0, 10) ? ("EXPIRING" as const) : ("ACTIVE" as const);
}
