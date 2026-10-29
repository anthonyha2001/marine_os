import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import type { CompanySlug } from "@/lib/permissions";
import { DATA_TAG } from "@/lib/cache-tag";

export const CHEQUE_STATUS = {
  IN_HAND: "In hand",
  DEPOSITED: "Deposited",
  ISSUED: "Given",
  CLEARED: "Cleared",
  BOUNCED: "Bounced",
  CANCELLED: "Cancelled",
} as const;
export type ChequeStatus = keyof typeof CHEQUE_STATUS;

async function loadCheques(companyId: string) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  const rows = await prisma.cheque.findMany({
    where: { companyId },
    include: {
      receipt: { select: { invoice: { select: { id: true, number: true } } } },
      supplierPayment: { select: { purchase: { select: { id: true, invoiceNumber: true } } } },
      bankAccount: { select: { code: true, name: true } },
    },
    orderBy: [{ dueDate: "asc" }],
  });
  return rows.map((c) => ({
    id: c.id,
    number: c.number,
    direction: c.direction as "RECEIVED" | "ISSUED",
    chequeNumber: c.chequeNumber,
    bank: c.bank,
    partyName: c.partyName,
    amount: Number(c.amount),
    issueDate: c.issueDate,
    dueDate: c.dueDate,
    status: c.status as ChequeStatus,
    invoice: c.receipt?.invoice ?? null,
    bill: c.supplierPayment?.purchase ?? null,
    bankAccount: c.bankAccount ? `${c.bankAccount.code} ${c.bankAccount.name}` : null,
    clearedAt: c.clearedAt,
    notes: c.notes,
  }));
}

export async function listCheques(slug: CompanySlug) {
  return loadCheques(await companyIdFor(slug));
}
export type ChequeRow = Awaited<ReturnType<typeof loadCheques>>[number];
export const isOpenCheque = (c: { status: ChequeStatus }) => c.status === "IN_HAND" || c.status === "DEPOSITED" || c.status === "ISSUED";
