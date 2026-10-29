import "server-only";
import { prisma } from "@/lib/prisma";

/** Does this customer get English + Arabic documents? */
export async function isBilingual(customerId: string | null | undefined) {
  if (!customerId) return false;
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { pdfLanguage: true } });
  return c?.pdfLanguage === "EN_AR";
}
