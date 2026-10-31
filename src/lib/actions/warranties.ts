"use server";

import { returnTarget } from "@/lib/return-to";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { vesselsTag } from "@/lib/data/vessels";
import { workshopTag } from "@/lib/data/workshop";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { nextNumber } from "@/lib/ledger/numbering";

export type WarrantyFormState = { error?: string };

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const warrantySchema = z.object({
  customerId: z.string().optional().transform((v) => v || null),
  customerName: z.string().trim().max(200).optional(),
  vesselId: z.string().optional().transform((v) => v || null),
  productId: z.string().optional().transform((v) => v || null),
  item: z.string().trim().min(2, "What is covered? (e.g. Yamaha F150 outboard)").max(300),
  serialNumber: text(120),
  startDate: day,
  months: z.coerce.number().int("Months must be a whole number").min(1, "At least 1 month").max(240),
  terms: text(4000),
  sourceType: text(20),
  sourceId: text(60),
  sourceLabel: text(60),
});

async function ctx(companySlug: string) {
  const c = await requireModule(companySlug, "workshop");
  return { ...c, companyId: await companyIdFor(c.slug) };
}

function refresh(companyId: string) {
  updateTag(workshopTag(companyId));
  updateTag(vesselsTag);
}

export async function createWarranty(companySlug: string, _prev: WarrantyFormState, formData: FormData): Promise<WarrantyFormState> {
  const { user, slug, companyId } = await ctx(companySlug);
  const parsed = warrantySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const customer = d.customerId ? await prisma.customer.findUnique({ where: { id: d.customerId }, select: { id: true, name: true } }) : null;
  const name = customer?.name ?? d.customerName?.trim();
  if (!name || name.length < 2) return { error: "Choose the customer or type their name." };
  const start = new Date(`${d.startDate}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + d.months);
  end.setUTCDate(end.getUTCDate() - 1);

  await prisma.$transaction(async (tx) => {
    await tx.warranty.create({
      data: {
        companyId,
        number: await nextNumber(tx, companyId, "WR", start.getUTCFullYear()),
        customerId: customer?.id ?? null,
        customerName: name,
        vesselId: d.vesselId,
        productId: d.productId,
        item: d.item,
        serialNumber: d.serialNumber,
        startDate: start,
        endDate: end,
        terms: d.terms,
        sourceType: d.sourceType,
        sourceId: d.sourceId,
        sourceLabel: d.sourceLabel,
        createdById: user.id,
      },
    });
  }, TRANSACTION_OPTIONS);
  refresh(companyId);
  redirect(returnTarget(slug, formData, "Warranty saved.") ?? `/c/${slug}/warranties?saved=1`);
}

export async function setWarrantyVoid(companySlug: string, warrantyId: string, voided: boolean): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  await prisma.warranty.updateMany({ where: { id: warrantyId, companyId }, data: { status: voided ? "VOID" : "ACTIVE" } });
  refresh(companyId);
  return {};
}

const claimSchema = z.object({
  date: day,
  description: z.string().trim().min(3, "Describe the problem").max(2000),
  status: z.enum(["OPEN", "ACCEPTED", "REJECTED", "RESOLVED"]),
  resolution: text(2000),
  jobCardId: z.string().optional().transform((v) => v || null),
});

/** Record a claim under a warranty (optionally linked to the job card that handled it). */
export async function addWarrantyClaim(companySlug: string, warrantyId: string, _prev: WarrantyFormState, formData: FormData): Promise<WarrantyFormState> {
  const { slug, companyId } = await ctx(companySlug);
  const parsed = claimSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const w = await prisma.warranty.findFirst({ where: { id: warrantyId, companyId }, select: { id: true } });
  if (!w) return { error: "This warranty no longer exists." };
  if (parsed.data.jobCardId && !(await prisma.jobCard.findFirst({ where: { id: parsed.data.jobCardId, companyId }, select: { id: true } }))) {
    return { error: "That job card doesn't belong to this company." };
  }
  await prisma.warrantyClaim.create({ data: { ...parsed.data, date: new Date(`${parsed.data.date}T00:00:00Z`), warrantyId } });
  refresh(companyId);
  redirect(`/c/${slug}/warranties?w=${warrantyId}`);
}

export async function setClaimStatus(companySlug: string, claimId: string, status: "OPEN" | "ACCEPTED" | "REJECTED" | "RESOLVED"): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  await prisma.warrantyClaim.updateMany({ where: { id: claimId, warranty: { companyId } }, data: { status } });
  refresh(companyId);
  return {};
}
