"use server";

import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { isServiceUnit } from "@/lib/catalogue";
import { tags } from "@/lib/data/inventory";
import { TRANSACTION_OPTIONS, nextItemCode } from "@/lib/item-codes";

export type ServiceFormState = { error?: string };

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Service name is too short").max(200),
  description: z.string().trim().max(2000).optional(),
  unit: z.string().refine(isServiceUnit, "Choose how the service is charged"),
  priceHT: z.coerce.number({ message: "Enter a price" }).min(0, "Price can't be negative").max(10_000_000),
});

/** Create (serviceId = null) or update a shared service. */
export async function saveService(
  companySlug: string,
  serviceId: string | null,
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const { slug } = await requireModule(companySlug, "services");

  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    unit: formData.get("unit") ?? "",
    priceHT: formData.get("priceHT"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, description, unit, priceHT } = parsed.data;
  const fields = { name, description: description ?? null, unit, priceHT };

  let savedCode: string;
  try {
    if (serviceId) {
      const existing = await prisma.product.findUnique({ where: { id: serviceId }, select: { type: true, code: true } });
      if (!existing || existing.type !== "SERVICE") return { error: "This service no longer exists." };
      await prisma.product.update({ where: { id: serviceId }, data: fields });
      savedCode = existing.code;
    } else {
      savedCode = await prisma.$transaction(async (tx) => {
        const code = await nextItemCode(tx);
        await tx.product.create({ data: { ...fields, code, type: "SERVICE", minQuantity: 0 } });
        return code;
      }, TRANSACTION_OPTIONS);
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That code was just taken by another item. Please save again." };
    }
    throw e;
  }

  updateTag(tags.products);
  // "Save & add another" (Ctrl+Shift+S) goes straight back to an empty form.
  if (formData.get("intent") === "new") redirect(`/c/${slug}/services?new=1&saved=${savedCode}`);
  redirect(`/c/${slug}/services?saved=${savedCode}`);
}

/** Delete a service. Offer lines keep their own copy of the title and price. */
export async function deleteService(companySlug: string, serviceId: string): Promise<{ error?: string }> {
  const { slug } = await requireModule(companySlug, "services");
  const service = await prisma.product.findUnique({ where: { id: serviceId }, select: { type: true } });
  if (!service || service.type !== "SERVICE") return { error: "This service no longer exists." };
  await prisma.product.delete({ where: { id: serviceId } });
  updateTag(tags.products);
  redirect(`/c/${slug}/services`);
}
