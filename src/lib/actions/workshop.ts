"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { businessToday } from "@/lib/dates";
import { companyIdFor, tags } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import { salesTags } from "@/lib/data/sales";
import { vesselsTag } from "@/lib/data/vessels";
import { workshopTag } from "@/lib/data/workshop";
import { withNumberRetry } from "@/lib/invoice-numbers";
import { createInvoiceWithLines } from "@/lib/invoicing";
import { averageCosts } from "@/lib/costing";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { nextNumber } from "@/lib/ledger/numbering";
import { round2 } from "@/lib/money";

export type WorkshopFormState = { error?: string };

const today = () => new Date(`${businessToday()}T00:00:00Z`);
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null));
const optionalInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : Math.round(Number(v))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Engine hours must be a whole number");

const lineSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["PART", "LABOR", "SERVICE"]),
  productId: z.string().nullable().optional(),
  title: z.string().trim().min(1, "Every line needs a description").max(300),
  quantity: z.number().positive("Quantities must be more than 0"),
  unitPrice: z.number().min(0, "Prices can't be negative"),
  billable: z.boolean(),
});

const jobSchema = z.object({
  vesselId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  customerName: z.string().trim().max(200).optional(),
  complaint: z.string().trim().min(3, "Describe the work requested").max(4000),
  workDone: z.string().trim().max(8000).optional(),
  technician: z.string().trim().max(120).optional(),
  engineHours: optionalInt,
  dueDate: optionalDate,
  applyVat: z.boolean(),
  lines: z.array(lineSchema).max(200),
});

async function ctx(companySlug: string) {
  const c = await requireModule(companySlug, "workshop");
  return { ...c, companyId: await companyIdFor(c.slug) };
}

function refresh(companyId: string, extra: { stock?: boolean; invoices?: boolean } = {}) {
  updateTag(workshopTag(companyId));
  updateTag(vesselsTag);
  if (extra.stock) updateTag(tags.stock(companyId));
  if (extra.invoices) {
    updateTag(salesTags.invoices(companyId));
    updateTag(ledgerTag(companyId));
  }
}

function parsePayload(formData: FormData) {
  try {
    return { raw: JSON.parse(String(formData.get("payload") ?? "")) as unknown };
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
}

/** Owner of the job: the vessel's owner, a saved customer, or a typed name. */
async function resolveCustomer(data: z.infer<typeof jobSchema>) {
  const vessel = data.vesselId ? await prisma.vessel.findUnique({ where: { id: data.vesselId }, select: { id: true, customer: { select: { id: true, name: true } } } }) : null;
  if (data.vesselId && !vessel) return { error: "That vessel no longer exists." };
  const customerId = data.customerId || vessel?.customer?.id || null;
  const customer = customerId ? await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true } }) : null;
  const name = customer?.name ?? data.customerName?.trim();
  if (!name || name.length < 2) return { error: "Choose the vessel or customer (or type the customer's name)." };
  return { customer: { id: customer?.id ?? null, name }, vesselId: vessel?.id ?? null };
}

export async function createJobCard(companySlug: string, _prev: WorkshopFormState, formData: FormData): Promise<WorkshopFormState> {
  const { user, slug, companyId } = await ctx(companySlug);
  const payload = parsePayload(formData);
  if (payload.error) return { error: payload.error };
  const parsed = jobSchema.safeParse(payload.raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const who = await resolveCustomer(data);
  if ("error" in who) return { error: who.error };

  const date = today();
  const id = await prisma.$transaction(async (tx) => {
    const job = await tx.jobCard.create({
      select: { id: true },
      data: {
        companyId,
        number: await nextNumber(tx, companyId, "JC", date.getUTCFullYear()),
        vesselId: who.vesselId,
        customerId: who.customer.id,
        customerName: who.customer.name,
        complaint: data.complaint,
        workDone: data.workDone || null,
        technician: data.technician || null,
        engineHours: data.engineHours,
        openedAt: date,
        dueDate: data.dueDate,
        applyVat: data.applyVat,
        createdById: user.id,
        lines: { create: data.lines.map((l, position) => lineData(l, position)) },
      },
    });
    return job.id;
  }, TRANSACTION_OPTIONS);
  refresh(companyId);
  redirect(`/c/${slug}/workshop/${id}?saved=1`);
}

function lineData(l: z.infer<typeof lineSchema>, position: number) {
  return {
    position,
    kind: l.kind,
    productId: l.productId || null,
    title: l.title,
    quantity: l.quantity,
    unitPrice: round2(l.unitPrice),
    lineTotal: round2(l.quantity * l.unitPrice),
    billable: l.billable,
  };
}

/** Start the work for an accepted offer: its lines are copied as "covered by the offer". */
export async function createJobCardFromOffer(companySlug: string, offerId: string) {
  const { user, slug, companyId } = await ctx(companySlug);
  const offer = await prisma.offer.findFirst({
    where: { id: offerId, companyId },
    include: { lines: { where: { kind: "ITEM" }, orderBy: { position: "asc" }, include: { product: { select: { type: true } } } } },
  });
  if (!offer) redirect(`/c/${slug}/offers`);
  const date = today();
  const id = await prisma.$transaction(async (tx) => {
    const job = await tx.jobCard.create({
      select: { id: true },
      data: {
        companyId,
        number: await nextNumber(tx, companyId, "JC", date.getUTCFullYear()),
        vesselId: offer.vesselId,
        customerId: offer.customerId,
        customerName: offer.customerName,
        offerId: offer.id,
        complaint: offer.subject ? `As per offer ${offer.number}: ${offer.subject}` : `Work as per offer ${offer.number}`,
        openedAt: date,
        applyVat: offer.applyVat,
        createdById: user.id,
        lines: {
          create: offer.lines.map((l, position) => {
            const unitPrice = round2(Number(l.unitPrice) * (1 - Number(l.discountPercent) / 100));
            return {
              position,
              kind: l.product?.type === "SERVICE" ? "SERVICE" : l.productId ? "PART" : "SERVICE",
              productId: l.productId,
              title: l.title,
              description: l.description,
              quantity: Number(l.quantity),
              unitPrice,
              lineTotal: round2(Number(l.quantity) * unitPrice),
              billable: false,
            };
          }),
        },
      },
    });
    return job.id;
  }, TRANSACTION_OPTIONS);
  refresh(companyId);
  redirect(`/c/${slug}/workshop/${id}?saved=1`);
}

/** Save the job card. Lines already invoiced are kept as they are. */
export async function saveJobCard(companySlug: string, jobId: string, _prev: WorkshopFormState, formData: FormData): Promise<WorkshopFormState> {
  const { slug, companyId } = await ctx(companySlug);
  const payload = parsePayload(formData);
  if (payload.error) return { error: payload.error };
  const parsed = jobSchema.safeParse(payload.raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const job = await prisma.jobCard.findFirst({ where: { id: jobId, companyId }, include: { lines: { select: { id: true, invoiceId: true } } } });
  if (!job) return { error: "This job card no longer exists." };
  if (job.status === "DONE" || job.status === "CANCELLED") return { error: "Reopen the job card to change it." };
  const who = await resolveCustomer(data);
  if ("error" in who) return { error: who.error };
  const invoiced = new Set(job.lines.filter((l) => l.invoiceId).map((l) => l.id));

  await prisma.$transaction(async (tx) => {
    await tx.jobCard.update({
      where: { id: jobId },
      data: {
        vesselId: who.vesselId,
        customerId: who.customer.id,
        customerName: who.customer.name,
        complaint: data.complaint,
        workDone: data.workDone || null,
        technician: data.technician || null,
        engineHours: data.engineHours,
        dueDate: data.dueDate,
        applyVat: data.applyVat,
      },
    });
    await tx.jobCardLine.deleteMany({ where: { jobCardId: jobId, invoiceId: null } });
    const editable = data.lines.filter((l) => !l.id || !invoiced.has(l.id));
    const start = job.lines.length + 1;
    for (const [i, l] of editable.entries()) await tx.jobCardLine.create({ data: { ...lineData(l, start + i), jobCardId: jobId } });
  }, TRANSACTION_OPTIONS);
  refresh(companyId);
  redirect(`/c/${slug}/workshop/${jobId}?saved=1`);
}

async function stockOut(tx: Tx, companyId: string, jobId: string) {
  const parts = await tx.jobCardLine.findMany({ where: { jobCardId: jobId, kind: "PART", productId: { not: null } }, include: { product: { select: { type: true } } } });
  const moves = parts.filter((l) => l.product?.type === "PRODUCT" && Number(l.quantity) > 0);
  const costs = await averageCosts(companyId, tx);
  for (const l of moves) await tx.jobCardLine.update({ where: { id: l.id }, data: { unitCost: costs.get(l.productId!) ?? 0 } });
  if (moves.length) {
    await tx.stockMovement.createMany({
      data: moves.map((l) => ({ companyId, productId: l.productId!, quantity: -Math.round(Number(l.quantity)), type: "JOB_CARD", jobCardId: jobId })),
    });
  }
}

/**
 * Move a job card along: Open → In progress → Done (parts used leave the stock) and back.
 * Cancel is refused once something was invoiced.
 */
export async function setJobCardStatus(companySlug: string, jobId: string, status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED"): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  const job = await prisma.jobCard.findFirst({ where: { id: jobId, companyId }, select: { status: true, invoices: { where: { status: { not: "CANCELLED" } }, select: { id: true } } } });
  if (!job) return { error: "This job card no longer exists." };
  if (status === "CANCELLED" && job.invoices.length) return { error: "This job card has an invoice. Cancel the invoice first." };
  await prisma.$transaction(async (tx) => {
    // Stock follows "Done": parts leave when the job is done and come back if it's reopened or cancelled.
    if (job.status === "DONE" && status !== "DONE") await tx.stockMovement.deleteMany({ where: { jobCardId: jobId } });
    if (status === "DONE" && job.status !== "DONE") await stockOut(tx, companyId, jobId);
    await tx.jobCard.update({ where: { id: jobId }, data: { status, completedAt: status === "DONE" ? today() : null } });
  }, TRANSACTION_OPTIONS);
  refresh(companyId, { stock: true });
  return {};
}

/** Invoice the job card's billable lines that aren't invoiced yet (optional: an offer may bill instead). */
export async function invoiceJobCard(companySlug: string, jobId: string, _prev: WorkshopFormState, formData: FormData): Promise<WorkshopFormState> {
  const { user, slug, companyId } = await ctx(companySlug);
  await requireModule(companySlug, "invoices");
  const dueDays = Math.max(0, Math.min(365, Math.round(Number(formData.get("dueDays")) || 0)));
  const job = await prisma.jobCard.findFirst({
    where: { id: jobId, companyId },
    include: { lines: { where: { billable: true, invoiceId: null }, orderBy: { position: "asc" } }, customer: true, vessel: { select: { name: true } } },
  });
  if (!job) return { error: "This job card no longer exists." };
  if (job.status === "CANCELLED") return { error: "This job card is cancelled." };
  if (!job.lines.length) return { error: job.offerId ? "Nothing extra to invoice: the work is covered by the offer. Bill it from the offer." : "There is nothing left to invoice on this job card." };

  const date = today();
  const invoice = await withNumberRetry(() =>
    prisma.$transaction(async (tx) => {
      const created = await createInvoiceWithLines(tx, {
        slug,
        companyId,
        createdById: user.id,
        invoiceDate: date,
        dueDate: new Date(date.getTime() + dueDays * 86400000),
        customer: job.customer
          ? { id: job.customer.id, name: job.customer.name, address: job.customer.address, email: job.customer.email, phone: job.customer.phone, taxNumber: job.customer.taxNumber, attention: job.customer.contactName }
          : { id: null, name: job.customerName },
        subject: `Job card ${job.number}${job.vessel ? ` · ${job.vessel.name}` : ""}`,
        reference: job.offerId ? "Additional work" : null,
        applyVat: job.applyVat,
        lines: job.lines.map((l) => ({ title: l.title, description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
        vesselId: job.vesselId,
        jobCardId: job.id,
      });
      await tx.jobCardLine.updateMany({ where: { id: { in: job.lines.map((l) => l.id) } }, data: { invoiceId: created.id } });
      return created;
    }, TRANSACTION_OPTIONS),
  );
  refresh(companyId, { invoices: true });
  redirect(`/c/${slug}/invoices/${invoice.id}`);
}

export async function deleteJobCard(companySlug: string, jobId: string): Promise<{ error?: string }> {
  const { slug, companyId } = await ctx(companySlug);
  const job = await prisma.jobCard.findFirst({ where: { id: jobId, companyId }, select: { status: true, _count: { select: { invoices: true } } } });
  if (!job) return { error: "This job card no longer exists." };
  if (job._count.invoices) return { error: "This job card has invoices, so it is kept. Cancel it instead." };
  await prisma.jobCard.delete({ where: { id: jobId } });
  refresh(companyId, { stock: job.status === "DONE" });
  redirect(`/c/${slug}/workshop`);
}
