import "server-only";
import type { Tx } from "@/lib/prisma";

// The database is far away (~0.3 s per query), so allow more than Prisma's 5 s default.
export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

/** Next free 4-digit code (starting at 1001), shared by products and services. */
export async function nextItemCode(tx: Tx) {
  const last = await tx.product.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const next = last ? Number(last.code) + 1 : 1001;
  if (next > 9999) throw new Error("All 4-digit codes are used.");
  return String(next);
}
