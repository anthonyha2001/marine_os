"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { businessToday } from "@/lib/dates";
import { appointmentsTag } from "@/lib/data/appointments";
import { APPOINTMENT_SLOTS, offerForCustomer, portalCustomer } from "@/lib/data/portal";
import { salesTags } from "@/lib/data/sales";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { nextNumber } from "@/lib/ledger/numbering";
import { isCompanySlug } from "@/lib/permissions";

// Actions customers run from their private links. No login: every action is checked against
// the secret token, and only touches that customer's own records.

export type PortalState = { error?: string; done?: boolean };

const respondSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  note: z.string().trim().max(1000).optional().transform((v) => v || null),
});

/** Accept or decline an offer online. */
export async function respondToOffer(
  where: { shareToken: string } | { portalToken: string; offerId: string },
  decision: "ACCEPT" | "DECLINE",
  _prev: PortalState,
  formData: FormData,
): Promise<PortalState> {
  const parsed = respondSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const offer = await offerForCustomer(where);
  if (!offer) return { error: "This link is no longer valid." };
  if (offer.status !== "SENT" && offer.status !== "DRAFT") return { error: offer.status === "ACCEPTED" ? "This offer was already accepted." : "This offer can no longer be answered." };
  if (decision === "ACCEPT" && offer.validUntil.toISOString().slice(0, 10) < businessToday()) return { error: "This offer has expired. Please contact us for an updated offer." };
  await prisma.offer.update({
    where: { id: offer.id },
    data: { status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED", respondedAt: new Date(), respondedName: parsed.data.name, customerNote: parsed.data.note },
  });
  updateTag(salesTags.offers(offer.companyId));
  return { done: true };
}

const bookingSchema = z.object({
  company: z.string().refine(isCompanySlug, "Choose who should do the work"),
  vesselId: z.string().optional().transform((v) => v || null),
  reason: z.string().trim().min(3, "Tell us what you need").max(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z.string().refine((t) => APPOINTMENT_SLOTS.includes(t), "Choose a time"),
  phone: z.string().trim().max(60).optional().transform((v) => v || null),
});

/** Request an appointment; the team confirms it (or proposes another time). */
export async function bookAppointment(portalToken: string, _prev: PortalState, formData: FormData): Promise<PortalState> {
  const customer = await portalCustomer(portalToken);
  if (!customer) return { error: "This link is no longer valid." };
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.date <= businessToday()) return { error: "Choose a date from tomorrow on." };
  if (new Date(`${d.date}T00:00:00Z`).getUTCDay() === 0) return { error: "We are closed on Sundays. Please choose another day." };
  if (d.vesselId && !(await prisma.vessel.findFirst({ where: { id: d.vesselId, customerId: customer.id }, select: { id: true } }))) return { error: "Choose one of your boats." };
  const company = await prisma.company.findUnique({ where: { slug: d.company }, select: { id: true } });
  if (!company) return { error: "Choose who should do the work." };
  const date = new Date(`${d.date}T00:00:00Z`);
  await prisma.$transaction(async (tx) => {
    await tx.appointment.create({
      data: {
        companyId: company.id,
        number: await nextNumber(tx, company.id, "AP", date.getUTCFullYear()),
        customerId: customer.id,
        customerName: customer.name,
        phone: d.phone ?? customer.phone,
        vesselId: d.vesselId,
        reason: d.reason,
        requestedDate: date,
        requestedTime: d.time,
        date,
        time: d.time,
        source: "PORTAL",
      },
    });
  }, TRANSACTION_OPTIONS);
  updateTag(appointmentsTag(company.id));
  redirect(`/p/${portalToken}?booked=1`);
}

/** The customer cancels a booking that hasn't happened yet. */
export async function cancelMyAppointment(portalToken: string, appointmentId: string): Promise<{ error?: string }> {
  const customer = await portalCustomer(portalToken);
  if (!customer) return { error: "This link is no longer valid." };
  const a = await prisma.appointment.findFirst({ where: { id: appointmentId, customerId: customer.id }, select: { id: true, status: true, companyId: true } });
  if (!a || (a.status !== "REQUESTED" && a.status !== "CONFIRMED")) return { error: "This appointment can't be cancelled." };
  await prisma.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED", customerNote: "Cancelled by the customer" } });
  updateTag(appointmentsTag(a.companyId));
  redirect(`/p/${portalToken}?cancelled=1`);
}
