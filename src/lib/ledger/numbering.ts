import "server-only";
import type { Tx } from "@/lib/prisma";

/**
 * Next number in a company's series, e.g. nextNumber(tx, id, "PV", 2026) → "PV-2026-0001".
 * The counter row is incremented atomically, so two users saving at once get different numbers.
 */
export async function nextNumber(tx: Tx, companyId: string, prefix: string, year: number, pad = 4) {
  const series = `${prefix}-${year}`;
  const counter = await tx.documentCounter.upsert({
    where: { companyId_series: { companyId, series } },
    update: { value: { increment: 1 } },
    create: { companyId, series, value: 1 },
    select: { value: true },
  });
  return `${series}-${String(counter.value).padStart(pad, "0")}`;
}
