import "server-only";
import { prisma, type Tx } from "@/lib/prisma";

// Invoices are in USD, but the VAT must also appear in Lebanese pounds. Each invoice and credit
// note keeps the rate of the day it was issued (the latest rate set for the company), so a printed
// invoice never changes afterwards. The same rate is used by the till.

export async function currentLbpRate(db: Tx | typeof prisma, companyId: string) {
  const r = await db.exchangeRate.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, select: { lbpPerUsd: true } });
  return r ? Number(r.lbpPerUsd) : null;
}

