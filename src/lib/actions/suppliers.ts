"use server";

import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { tags } from "@/lib/data/inventory";

export type SupplierFormState = { error?: string; success?: string };

const optional = z
  .string()
  .trim()
  .max(500)
  .transform((v) => v || null);

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is too short").max(200),
  accountNumber: optional,
  phone: optional,
  email: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email or leave it empty"),
  address: optional,
  notes: optional,
});

/** Create (supplierId = null) or update a shared supplier. */
export async function saveSupplier(
  companySlug: string,
  supplierId: string | null,
  _prev: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  await requireModule(companySlug, "suppliers");

  const parsed = supplierSchema.safeParse({
    name: formData.get("name") ?? "",
    accountNumber: formData.get("accountNumber") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    if (supplierId) {
      await prisma.supplier.update({ where: { id: supplierId }, data: parsed.data });
    } else {
      await prisma.supplier.create({ data: parsed.data });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `A supplier called "${parsed.data.name}" already exists.` };
    }
    throw e;
  }

  updateTag(tags.suppliers);
  updateTag(tags.products); // the catalogue shows supplier names
  return { success: supplierId ? "Supplier updated" : `${parsed.data.name} was added` };
}
