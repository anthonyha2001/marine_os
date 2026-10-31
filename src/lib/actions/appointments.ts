"use server";

import { returnTarget } from "@/lib/return-to";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { appointmentsTag } from "@/lib/data/appointments";
import { companyIdFor } from "@/lib/data/inventory";
import { APPOINTMENT_SLOTS } from "@/lib/data/portal";
import { workshopTag } from "@/lib/data/workshop";
import { businessToday } from "@/lib/dates";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { nextNumber } from "@/lib/ledger/numbering";

export type AppointmentFormState = { error?: string };

async function ctx(companySlug: string) {
  const c = await requireModule(companySlug, "workshop");
  return { ...c, companyId: await companyIdFor(c.slug) };
}

const slotSchema = {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z.string().refine((t) => APPOINTMENT_SLOTS.includes(t), "Choose a time"),
};

const staffSchema = z.object({
  ...slotSchema,
  customerId: z.string().optional().transform((v) => v || null),
  customerName: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(60).optional().transform((v) => v || null),
  vesselId: z.string().optional().transform((v) => v || null),
  reason: z.string().trim().min(3, "What is the appointment for?").max(1000),
  staffNote: z.string().trim().max(1000).optional().transform((v) => v || null),
});

/** Book an appointment for a customer who called (confirmed straight away). */
export async function createAppointment(companySlug: string, _prev: AppointmentFormState, formData: FormData): Promise<AppointmentFormState> {
  const { slug, companyId } = await ctx(companySlug);
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const customer = d.customerId ? await prisma.customer.findUnique({ where: { id: d.customerId }, select: { id: true, name: true, phone: true } }) : null;
  const name = customer?.name ?? d.customerName?.trim();
  if (!name || name.length < 2) return { error: "Choose the customer or type their name." };
  const date = new Date(`${d.date}T00:00:00Z`);
  await prisma.$transaction(async (tx) => {
    await tx.appointment.create({
      data: {
        companyId,
        number: await nextNumber(tx, companyId, "AP", date.getUTCFullYear()),
        customerId: customer?.id ?? null,
        customerName: name,
        phone: d.phone ?? customer?.phone ?? null,
        vesselId: d.vesselId,
        reason: d.reason,
        requestedDate: date,
        requestedTime: d.time,
        date,
        time: d.time,
        status: "CONFIRMED",
        source: "STAFF",
        staffNote: d.staffNote,
      },
    });
  }, TRANSACTION_OPTIONS);
  updateTag(appointmentsTag(companyId));
  redirect(returnTarget(slug, formData, "Appointment booked.") ?? `/c/${slug}/appointments?date=${d.date}`);
}

const confirmSchema = z.object({ ...slotSchema, staffNote: z.string().trim().max(1000).optional().transform((v) => v || null) });

/** Confirm a request, at the time asked or another one (the customer sees it in their portal). */
export async function confirmAppointment(companySlug: string, appointmentId: string, _prev: AppointmentFormState, formData: FormData): Promise<AppointmentFormState> {
  const { slug, companyId } = await ctx(companySlug);
  const parsed = confirmSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const updated = await prisma.appointment.updateMany({
    where: { id: appointmentId, companyId, status: { in: ["REQUESTED", "CONFIRMED"] } },
    data: { status: "CONFIRMED", date: new Date(`${parsed.data.date}T00:00:00Z`), time: parsed.data.time, staffNote: parsed.data.staffNote },
  });
  if (!updated.count) return { error: "This appointment can no longer be confirmed." };
  updateTag(appointmentsTag(companyId));
  redirect(`/c/${slug}/appointments?date=${parsed.data.date}`);
}

export async function setAppointmentStatus(companySlug: string, appointmentId: string, status: "DECLINED" | "DONE" | "CANCELLED"): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  await prisma.appointment.updateMany({ where: { id: appointmentId, companyId }, data: { status } });
  updateTag(appointmentsTag(companyId));
  return {};
}

/** The boat arrived: open a job card with the appointment's details. */
export async function appointmentToJobCard(companySlug: string, appointmentId: string) {
  const { user, slug, companyId } = await ctx(companySlug);
  const a = await prisma.appointment.findFirst({ where: { id: appointmentId, companyId } });
  if (!a) redirect(`/c/${slug}/appointments`);
  if (a.jobCardId) redirect(`/c/${slug}/workshop/${a.jobCardId}`);
  const date = new Date(`${businessToday()}T00:00:00Z`);
  const jobId = await prisma.$transaction(async (tx) => {
    const job = await tx.jobCard.create({
      select: { id: true },
      data: {
        companyId,
        number: await nextNumber(tx, companyId, "JC", date.getUTCFullYear()),
        vesselId: a.vesselId,
        customerId: a.customerId,
        customerName: a.customerName,
        complaint: a.reason,
        openedAt: date,
        createdById: user.id,
      },
    });
    await tx.appointment.update({ where: { id: a.id }, data: { jobCardId: job.id, status: "DONE" } });
    return job.id;
  }, TRANSACTION_OPTIONS);
  updateTag(appointmentsTag(companyId));
  updateTag(workshopTag(companyId));
  redirect(`/c/${slug}/workshop/${jobId}?saved=1`);
}
