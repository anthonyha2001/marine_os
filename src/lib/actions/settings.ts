"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { salesTags } from "@/lib/data/sales";

export type CompanyFormState = { error?: string; success?: string };

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const companySchema = z.object({
  legalName: text(200),
  address: text(500),
  phone: text(100),
  email: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email or leave it empty"),
  website: text(200),
  taxNumber: text(100),
  registrationNumber: text(100),
  bankDetails: text(1000),
  offerTerms: text(5000),
  labourCostPerHour: z.coerce.number({ message: "Enter the labour cost per hour" }).min(0, "The labour cost can't be negative").max(10000),
});

const FIELDS = Object.keys(companySchema.shape);

/** Letterhead details for the company being viewed (admin or that company's manager). */
export async function saveCompanyProfile(
  companySlug: string,
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const { slug } = await requireModule(companySlug, "settings");
  const parsed = companySchema.safeParse(Object.fromEntries(FIELDS.map((k) => [k, formData.get(k) ?? ""])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const companyId = await companyIdFor(slug);
  await prisma.company.update({ where: { id: companyId }, data: parsed.data });
  updateTag(salesTags.company(companyId));
  return { success: "Company details saved. New PDFs will use them." };
}
