import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import type { AppointmentStatus } from "@/lib/data/portal";
import type { CompanySlug } from "@/lib/permissions";

export const appointmentsTag = (companyId: string) => `appointments:${companyId}`;

async function loadAppointments(companyId: string) {
  "use cache";
  cacheTag(appointmentsTag(companyId));
  cacheLife("hours");
  const rows = await prisma.appointment.findMany({
    where: { companyId },
    include: { vessel: { select: { id: true, name: true } }, jobCard: { select: { id: true, number: true } } },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    number: a.number,
    customerId: a.customerId,
    customerName: a.customerName,
    phone: a.phone,
    vessel: a.vessel,
    reason: a.reason,
    requestedDate: a.requestedDate,
    requestedTime: a.requestedTime,
    date: a.date,
    time: a.time,
    status: a.status as AppointmentStatus,
    source: a.source as "PORTAL" | "STAFF",
    customerNote: a.customerNote,
    staffNote: a.staffNote,
    jobCard: a.jobCard,
    createdAt: a.createdAt,
  }));
}

export async function listAppointments(slug: CompanySlug) {
  return loadAppointments(await companyIdFor(slug));
}
export type AppointmentRow = Awaited<ReturnType<typeof loadAppointments>>[number];
