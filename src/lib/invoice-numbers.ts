import "server-only";
import { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/prisma";
import type { CompanySlug } from "@/lib/permissions";

const NUMBER_PREFIX: Record<CompanySlug, string> = { "xpert-marine": "XM", "eliche-radice": "ER" };

/** Next invoice number for a company and year, e.g. XM-INV-2026-0007. */
export async function nextInvoiceNumber(tx: Tx, slug: CompanySlug, year: number) {
  const prefix = `${NUMBER_PREFIX[slug]}-INV-${year}-`;
  const last = await tx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return prefix + String((last ? Number(last.number.slice(prefix.length)) : 0) + 1).padStart(4, "0");
}

/** Run invoice creation, retrying if two people race for the same number. */
export async function withNumberRetry<T>(fn: () => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 3) continue;
      throw e;
    }
  }
}
