"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { businessToday } from "@/lib/dates";
import { appointmentsTag } from "@/lib/data/appointments";
import { vesselsTag } from "@/lib/data/vessels";
import { workshopTag } from "@/lib/data/workshop";
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
  redirect(`/p/${portalToken}/appointments?booked=1`);
}

/** The customer cancels a booking that hasn't happened yet. */
export async function cancelMyAppointment(portalToken: string, appointmentId: string): Promise<{ error?: string }> {
  const customer = await portalCustomer(portalToken);
  if (!customer) return { error: "This link is no longer valid." };
  const a = await prisma.appointment.findFirst({ where: { id: appointmentId, customerId: customer.id }, select: { id: true, status: true, companyId: true } });
  if (!a || (a.status !== "REQUESTED" && a.status !== "CONFIRMED")) return { error: "This appointment can't be cancelled." };
  await prisma.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED", customerNote: "Cancelled by the customer" } });
  updateTag(appointmentsTag(a.companyId));
  redirect(`/p/${portalToken}/appointments?cancelled=1`);
}

// ---- Messages, engine hours, warranty claims, profile -------------------------------------

const companyIdOf = async (slug: string) => (isCompanySlug(slug) ? ((await prisma.company.findUnique({ where: { slug }, select: { id: true } }))?.id ?? null) : null);

/** Adds a customer message to a conversation (or starts one) and flags it for the team. */
async function postFromCustomer(
  customer: { id: string; name: string },
  data: { companyId: string; subject: string; topic: string; body: string; vesselId?: string | null; warrantyId?: string | null; threadId?: string },
) {
  if (data.threadId) {
    await prisma.portalThread.update({
      where: { id: data.threadId },
      data: { staffUnread: true, status: "OPEN", lastMessageAt: new Date(), messages: { create: { fromCustomer: true, authorName: customer.name, body: data.body } } },
    });
    return data.threadId;
  }
  const t = await prisma.portalThread.create({
    data: {
      companyId: data.companyId,
      customerId: customer.id,
      subject: data.subject,
      topic: data.topic,
      vesselId: data.vesselId ?? null,
      warrantyId: data.warrantyId ?? null,
      messages: { create: { fromCustomer: true, authorName: customer.name, body: data.body } },
    },
    select: { id: true },
  });
  return t.id;
}

const threadSchema = z.object({
  company: z.string().refine(isCompanySlug, "Choose who you are writing to"),
  topic: z.enum(["QUESTION", "QUOTE", "SERVICE"]),
  subject: z.string().trim().min(3, "Add a short subject").max(140),
  body: z.string().trim().min(3, "Write your message").max(4000),
  vesselId: z.string().optional().transform((v) => v || null),
});

/** A question or a quote request to one of the companies. */
export async function startThread(portalToken: string, _prev: PortalState, formData: FormData): Promise<PortalState> {
  const customer = await portalCustomer(portalToken);
  if (!customer) return { error: "This link is no longer valid." };
  const parsed = threadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const cid = await companyIdOf(d.company);
  if (!cid) return { error: "Choose who you are writing to." };
  if (d.vesselId && !(await prisma.vessel.findFirst({ where: { id: d.vesselId, customerId: customer.id }, select: { id: true } }))) return { error: "Choose one of your boats." };
  const id = await postFromCustomer(customer, { companyId: cid, subject: d.subject, topic: d.topic, body: d.body, vesselId: d.vesselId });
  redirect(`/p/${portalToken}/messages/${id}?sent=1`);
}

/** The customer answers in an existing conversation. */
export async function replyAsCustomer(portalToken: string, threadId: string, _prev: PortalState, formData: FormData): Promise<PortalState> {
  const customer = await portalCustomer(portalToken);
  if (!customer) return { error: "This link is no longer valid." };
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write your message." };
  if (body.length > 4000) return { error: "That message is too long." };
  const thread = await prisma.portalThread.findFirst({ where: { id: threadId, customerId: customer.id }, select: { id: true, companyId: true } });
  if (!thread) return { error: "This conversation no longer exists." };
  await postFromCustomer(customer, { companyId: thread.companyId, subject: "", topic: "", body, threadId: thread.id });
  refresh();
  return { done: true };
}

/** The customer reads the engine hour meters; the workshop sees it in Messages. */
export async function updateEngineHours(portalToken: string, vesselId: string, _prev: PortalState, formData: FormData): Promise<PortalState> {
  const customer = await portalCustomer(portalToken);
  if (!customer) return { error: "This link is no longer valid." };
  const vessel = await prisma.vessel.findFirst({ where: { id: vesselId, customerId: customer.id }, include: { engines: true } });
  if (!vessel) return { error: "This boat is not on your account." };
  const changes: { id: string; label: string; hours: number; before: number | null }[] = [];
  for (const e of vessel.engines) {
    const raw = String(formData.get(`hours-${e.id}`) ?? "").trim();
    if (!raw) continue;
    const hours = Math.round(Number(raw));
    if (!Number.isFinite(hours) || hours < 0 || hours > 200000) return { error: `Check the hours for the ${e.position.toLowerCase()} engine.` };
    if (e.hours !== null && hours < e.hours) return { error: `The ${e.position.toLowerCase()} engine had ${e.hours} h before: hours can't go down.` };
    if (hours !== e.hours) changes.push({ id: e.id, label: [e.position, e.make, e.model].filter(Boolean).join(" "), hours, before: e.hours });
  }
  if (!changes.length) return { error: "Enter at least one new reading." };
  const workshop = await companyIdOf("xpert-marine");
  await prisma.$transaction(async (tx) => {
    for (const c of changes) await tx.vesselEngine.update({ where: { id: c.id }, data: { hours: c.hours, hoursAt: new Date(), hoursBy: "Customer" } });
    if (workshop)
      await tx.portalThread.create({
        data: {
          companyId: workshop,
          customerId: customer.id,
          vesselId: vessel.id,
          subject: `Engine hours · ${vessel.name}`,
          topic: "INFO",
          messages: {
            create: {
              fromCustomer: true,
              authorName: customer.name,
              body: changes.map((c) => `${c.label}: ${c.hours} h${c.before !== null ? ` (was ${c.before} h)` : ""}`).join("\n"),
            },
          },
        },
      });
  }, TRANSACTION_OPTIONS);
  updateTag(vesselsTag);
  refresh();
  return { done: true };
}

const claimSchema = z.object({ description: z.string().trim().min(10, "Describe the problem (at least a sentence)").max(4000) });

/** A warranty claim: recorded on the warranty and opened as a conversation with the company. */
export async function claimWarranty(portalToken: string, warrantyId: string, _prev: PortalState, formData: FormData): Promise<PortalState> {
  const customer = await portalCustomer(portalToken);
  if (!customer) return { error: "This link is no longer valid." };
  const parsed = claimSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const w = await prisma.warranty.findFirst({
    where: { id: warrantyId, customerId: customer.id },
    select: { id: true, number: true, item: true, companyId: true, endDate: true, status: true, vesselId: true },
  });
  if (!w) return { error: "This warranty is not on your account." };
  if (w.status === "VOID") return { error: "This warranty is no longer valid. Please write to us instead." };
  if (w.endDate.toISOString().slice(0, 10) < businessToday()) return { error: "This warranty has ended. Please write to us instead." };
  const threadId = await prisma.$transaction(async (tx) => {
    await tx.warrantyClaim.create({ data: { warrantyId: w.id, date: new Date(`${businessToday()}T00:00:00Z`), description: `From the customer portal: ${parsed.data.description}` } });
    const t = await tx.portalThread.create({
      data: {
        companyId: w.companyId,
        customerId: customer.id,
        vesselId: w.vesselId,
        warrantyId: w.id,
        subject: `Warranty claim · ${w.item} (${w.number})`,
        topic: "CLAIM",
        messages: { create: { fromCustomer: true, authorName: customer.name, body: parsed.data.description } },
      },
      select: { id: true },
    });
    return t.id;
  }, TRANSACTION_OPTIONS);
  updateTag(workshopTag(w.companyId));
  redirect(`/p/${portalToken}/messages/${threadId}?sent=1`);
}

const profileSchema = z.object({
  contactName: z.string().trim().max(120).optional().transform((v) => v || null),
  phone: z.string().trim().max(60).optional().transform((v) => v || null),
  email: z.union([z.literal(""), z.string().trim().email("Check the email address").max(200)]).transform((v) => v || null),
  address: z.string().trim().max(500).optional().transform((v) => v || null),
});

/** The customer keeps their own contact details up to date. */
export async function updateMyDetails(portalToken: string, _prev: PortalState, formData: FormData): Promise<PortalState> {
  const customer = await portalCustomer(portalToken);
  if (!customer) return { error: "This link is no longer valid." };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.customer.update({ where: { id: customer.id }, data: parsed.data });
  updateTag(salesTags.customers);
  refresh();
  return { done: true };
}
