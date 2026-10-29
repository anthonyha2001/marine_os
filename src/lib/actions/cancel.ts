"use server";

import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { businessToday } from "@/lib/dates";
import { payablesTag } from "@/lib/data/accounting";
import { companyIdFor, tags } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import { salesTags } from "@/lib/data/sales";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { refreshInvoiceStatus } from "@/lib/ledger/invoice-status";
import { postEntry, reverseEntries } from "@/lib/ledger/posting";
import { can, type ModuleKey } from "@/lib/permissions";

// Cancelling keeps a posted entry on record, stamped CANCELLED with who, when and why, and posts
// a reversing journal entry dated today, so the books show both the original and its reversal.

type Result = { error?: string };

async function start(companySlug: string, mod: ModuleKey, reason: string) {
  const { user, slug } = await requireModule(companySlug, mod);
  if (!can(user, "cancelEntries")) return { error: "You don't have permission to cancel entries. Ask your manager." } as const;
  const why = reason.trim().slice(0, 500);
  if (why.length < 3) return { error: "Give the reason for cancelling." } as const;
  return { user, companyId: await companyIdFor(slug), why, today: new Date(`${businessToday()}T00:00:00Z`) };
}

const stamp = (name: string, why: string) => ({ status: "CANCELLED", cancelledAt: new Date(), cancelledByName: name, cancelReason: why });

export async function cancelSupplierPayment(companySlug: string, paymentId: string, reason: string): Promise<Result> {
  const c = await start(companySlug, "accounting", reason);
  if ("error" in c) return c;
  const payment = await prisma.supplierPayment.findFirst({ where: { id: paymentId, companyId: c.companyId }, select: { status: true, number: true } });
  if (!payment) return { error: "This payment no longer exists." };
  if (payment.status === "CANCELLED") return { error: "This payment is already cancelled." };
  if (await prisma.cheque.count({ where: { supplierPaymentId: paymentId } })) return { error: "This payment is a cheque. On the Cheques page, mark it as bounced or cancelled instead." };
  await prisma.$transaction(async (tx) => {
    await reverseEntries(tx, "SUPPLIER_PAYMENT", paymentId, c.today, c.user.id, `Cancelled payment ${payment.number ?? ""}: ${c.why}`);
    await tx.supplierPayment.update({ where: { id: paymentId }, data: stamp(c.user.name, c.why) });
  }, TRANSACTION_OPTIONS);
  updateTag(payablesTag(c.companyId));
  updateTag(ledgerTag(c.companyId));
  updateTag(tags.purchases(c.companyId));
  return {};
}

export async function cancelReceipt(companySlug: string, receiptId: string, reason: string): Promise<Result> {
  const c = await start(companySlug, "invoices", reason);
  if ("error" in c) return c;
  const receipt = await prisma.customerReceipt.findFirst({ where: { id: receiptId, companyId: c.companyId }, select: { status: true, number: true, invoiceId: true } });
  if (!receipt) return { error: "This receipt no longer exists." };
  if (receipt.status === "CANCELLED") return { error: "This receipt is already cancelled." };
  if (await prisma.cheque.count({ where: { receiptId } })) return { error: "This receipt is a cheque. On the Cheques page, mark it as bounced or cancelled instead." };
  await prisma.$transaction(async (tx) => {
    await reverseEntries(tx, "RECEIPT", receiptId, c.today, c.user.id, `Cancelled receipt ${receipt.number}: ${c.why}`);
    await tx.customerReceipt.update({ where: { id: receiptId }, data: stamp(c.user.name, c.why) });
    if (receipt.invoiceId) await refreshInvoiceStatus(tx, receipt.invoiceId);
  }, TRANSACTION_OPTIONS);
  updateTag(ledgerTag(c.companyId));
  updateTag(salesTags.invoices(c.companyId));
  return {};
}

export async function cancelVoucher(companySlug: string, voucherId: string, reason: string): Promise<Result> {
  const c = await start(companySlug, "accounting", reason);
  if ("error" in c) return c;
  const voucher = await prisma.voucher.findFirst({ where: { id: voucherId, companyId: c.companyId }, select: { status: true, number: true } });
  if (!voucher) return { error: "This voucher no longer exists." };
  if (voucher.status === "CANCELLED") return { error: "This voucher is already cancelled." };
  await prisma.$transaction(async (tx) => {
    await reverseEntries(tx, "VOUCHER", voucherId, c.today, c.user.id, `Cancelled voucher ${voucher.number}: ${c.why}`);
    await tx.voucher.update({ where: { id: voucherId }, data: stamp(c.user.name, c.why) });
  }, TRANSACTION_OPTIONS);
  updateTag(ledgerTag(c.companyId));
  return {};
}

/** A manual journal entry is reversed by a new entry with debits and credits swapped. */
export async function reverseJournalEntry(companySlug: string, entryId: string, reason: string): Promise<Result> {
  const c = await start(companySlug, "accounting", reason);
  if ("error" in c) return c;
  const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, companyId: c.companyId }, include: { lines: true } });
  if (!entry) return { error: "This entry no longer exists." };
  if (entry.sourceType !== "MANUAL") return { error: "Automatic entries are cancelled through their document (invoice, payment, voucher…)." };
  if (await prisma.journalEntry.count({ where: { reversalOf: entry.id } })) return { error: "This entry is already reversed." };
  await prisma.$transaction(async (tx) => {
    await postEntry(tx, {
      companyId: c.companyId,
      date: c.today,
      memo: `Reverses ${entry.number}: ${c.why}`,
      sourceType: "REVERSAL",
      sourceId: entry.id,
      reversalOf: entry.id,
      createdById: c.user.id,
      lines: entry.lines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.credit),
        credit: Number(l.debit),
        description: l.description,
        customerId: l.customerId,
        customerName: l.customerName,
        supplierId: l.supplierId,
      })),
    });
  }, TRANSACTION_OPTIONS);
  updateTag(ledgerTag(c.companyId));
  return {};
}
