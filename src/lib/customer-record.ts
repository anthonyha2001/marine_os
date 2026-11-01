import "server-only";
import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { salesTags } from "@/lib/data/sales";

type Details = { phone?: string | null; email?: string | null; address?: string | null; contactName?: string | null; taxNumber?: string | null };
const select = { id: true, name: true, phone: true, email: true, address: true, contactName: true, taxNumber: true } as const;

/**
 * The saved customer with this name (any capitalisation), created on the spot if there is
 * none, so every document is linked to a real customer.
 */
export async function customerNamed(name: string, details: Details = {}) {
  const clean = name.trim().replace(/\s+/g, " ");
  const found = await prisma.customer.findFirst({ where: { name: { equals: clean, mode: "insensitive" } }, select });
  if (found) return found;
  try {
    const created = await prisma.customer.create({
      data: {
        name: clean,
        phone: details.phone || null,
        email: details.email || null,
        address: details.address || null,
        contactName: details.contactName || null,
        taxNumber: details.taxNumber || null,
      },
      select,
    });
    updateTag(salesTags.customers);
    return created;
  } catch (e) {
    // Created by someone else at the same moment.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return prisma.customer.findFirstOrThrow({ where: { name: clean }, select });
    throw e;
  }
}

/** Every product / service id that exists in the catalogue, out of these. */
export async function existingProductIds(ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (!wanted.length) return new Set<string>();
  const rows = await prisma.product.findMany({ where: { id: { in: wanted } }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export const NOT_IN_CATALOGUE = (title: string) => `"${title}" is not in the catalogue. Pick a product or service from the list (add it under Stock first if it's new).`;
