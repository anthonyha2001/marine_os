"use server";

import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { salesTags } from "@/lib/data/sales";

export type CustomerFormState = { error?: string; success?: string };

const optional = z
  .string()
  .trim()
  .max(1000)
  .transform((v) => v || null);

const customerSchema = z.object({
  name: z.string().trim().min(2, "Customer name is too short").max(200),
  contactName: optional,
  phone: optional,
  email: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email or leave it empty"),
  address: optional,
  taxNumber: optional,
  notes: optional,
});

/** Create (customerId = null) or update a shared customer. */
export async function saveCustomer(
  companySlug: string,
  customerId: string | null,
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const { slug } = await requireModule(companySlug, "customers");

  const parsed = customerSchema.safeParse(
    Object.fromEntries(
      ["name", "contactName", "phone", "email", "address", "taxNumber", "notes"].map((k) => [k, formData.get(k) ?? ""]),
    ),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    if (customerId) await prisma.customer.update({ where: { id: customerId }, data: parsed.data });
    else await prisma.customer.create({ data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `A customer called "${parsed.data.name}" already exists.` };
    }
    throw e;
  }

  updateTag(salesTags.customers);
  // New customers are added from a pop-up: go back to the list, which closes it.
  if (!customerId) redirect(`/c/${slug}/customers?added=${encodeURIComponent(parsed.data.name)}`);
  return { success: "Customer updated" };
}
