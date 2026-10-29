"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { businessToday } from "@/lib/dates";
import { payablesTag } from "@/lib/data/accounting";
import { companyIdFor } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import { salesTags } from "@/lib/data/sales";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { invoiceBalance, refreshInvoiceStatus } from "@/lib/ledger/invoice-status";
import { systemAccounts } from "@/lib/ledger/chart";
import { nextNumber } from "@/lib/ledger/numbering";
import { postChequeCleared, postReceipt, postSupplierPayment, reverseEntries } from "@/lib/ledger/posting";
import { round2 } from "@/lib/money";

export type ChequeFormState = { error?: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
const toDate = (d: string) => new Date(`${d}T00:00:00Z`);
class UserError extends Error {}

const chequeFields = {
  chequeNumber: z.string().trim().min(1, "Enter the cheque number").max(40),
  bank: z.string().trim().max(80).optional().transform((v) => v || null),
  amount: z.coerce.number({ message: "Enter the amount" }).positive("The amount must be more than 0"),
  issueDate: day,
  dueDate: day,
  notes: z.string().trim().max(1000).optional().transform((v) => v || null),
};

async function ctx(companySlug: string) {
  const c = await requireModule(companySlug, "accounting");
  return { ...c, companyId: await companyIdFor(c.slug) };
}

function refresh(companyId: string) {
  updateTag(ledgerTag(companyId));
  updateTag(salesTags.invoices(companyId));
  updateTag(payablesTag(companyId));
}

const receivedSchema = z.object({
  ...chequeFields,
  invoiceId: z.string().optional().transform((v) => v || null),
  customerId: z.string().optional().transform((v) => v || null),
});

/**
 * A customer's cheque (often post-dated). It settles the invoice now — the money sits in
 * "Cheques to collect" (5113) until the bank pays it.
 */
export async function receiveCheque(companySlug: string, _prev: ChequeFormState, formData: FormData): Promise<ChequeFormState> {
  const { user, slug, companyId } = await ctx(companySlug);
  const parsed = receivedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.dueDate < d.issueDate) return { error: "The cheque date can't be before the day it was given." };
  const invoice = d.invoiceId
    ? await prisma.invoice.findFirst({ where: { id: d.invoiceId, companyId, status: { not: "CANCELLED" } }, select: { id: true, number: true, customerId: true, customerName: true } })
    : null;
  if (d.invoiceId && !invoice) return { error: "That invoice no longer exists." };
  const customer = invoice
    ? { id: invoice.customerId, name: invoice.customerName }
    : d.customerId
      ? await prisma.customer.findUnique({ where: { id: d.customerId }, select: { id: true, name: true } })
      : null;
  if (!customer) return { error: "Choose the invoice or the customer the cheque is from." };
  const amount = round2(d.amount);

  try {
    await prisma.$transaction(async (tx) => {
      if (invoice) {
        const bal = await invoiceBalance(tx, invoice.id);
        if (!bal || amount > bal.balance + 0.005) throw new UserError(`Only ${money.format(bal?.balance ?? 0)} is left to pay on ${invoice.number}.`);
      }
      const a = await systemAccounts(companyId, tx);
      const date = toDate(d.issueDate);
      const rcNumber = await nextNumber(tx, companyId, "RC", date.getUTCFullYear());
      const receipt = await tx.customerReceipt.create({
        select: { id: true },
        data: {
          companyId, number: rcNumber, invoiceId: invoice?.id ?? null, customerId: customer.id, customerName: customer.name, amount, receivedAt: date,
          method: "CHEQUE", moneyAccountId: a.CHEQUES_IN, reference: `Cheque ${d.chequeNumber}${d.bank ? ` · ${d.bank}` : ""} due ${d.dueDate}`, notes: d.notes, createdById: user.id,
        },
      });
      await postReceipt(tx, { id: receipt.id, companyId, number: rcNumber, amount, receivedAt: date, moneyAccountId: a.CHEQUES_IN, customerId: customer.id, customerName: customer.name, invoiceNumber: invoice?.number ?? null, createdById: user.id });
      if (invoice) await refreshInvoiceStatus(tx, invoice.id);
      await tx.cheque.create({
        data: {
          companyId, number: await nextNumber(tx, companyId, "CQ", date.getUTCFullYear()), direction: "RECEIVED", chequeNumber: d.chequeNumber, bank: d.bank,
          partyName: customer.name, customerId: customer.id, amount, issueDate: date, dueDate: toDate(d.dueDate), status: "IN_HAND", receiptId: receipt.id, notes: d.notes, createdById: user.id,
        },
      });
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  refresh(companyId);
  redirect(`/c/${slug}/finance/cheques?saved=1`);
}

const issuedSchema = z.object({ ...chequeFields, purchaseId: z.string().min(1, "Choose the supplier bill") });

/** A cheque we give a supplier: the bill is paid now; the bank pays it later (account 403 meanwhile). */
export async function issueCheque(companySlug: string, _prev: ChequeFormState, formData: FormData): Promise<ChequeFormState> {
  const { user, slug, companyId } = await ctx(companySlug);
  const parsed = issuedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.dueDate < d.issueDate) return { error: "The cheque date can't be before the day it was given." };
  const purchase = await prisma.purchase.findFirst({
    where: { id: d.purchaseId, companyId },
    select: { id: true, invoiceNumber: true, supplierId: true, supplier: { select: { name: true } }, totalTTC: true, payments: { where: { status: "POSTED" }, select: { amount: true } } },
  });
  if (!purchase) return { error: "That bill no longer exists." };
  const balance = round2(Number(purchase.totalTTC) - purchase.payments.reduce((s, p) => s + Number(p.amount), 0));
  const amount = round2(d.amount);
  if (amount > balance + 0.005) return { error: `Only ${money.format(balance)} is left to pay on this bill.` };

  await prisma.$transaction(async (tx) => {
    const a = await systemAccounts(companyId, tx);
    const date = toDate(d.issueDate);
    const number = await nextNumber(tx, companyId, "PV", date.getUTCFullYear());
    const payment = await tx.supplierPayment.create({
      select: { id: true },
      data: {
        companyId, number, purchaseId: purchase.id, amount, paidAt: date, method: "CHEQUE", moneyAccountId: a.CHEQUES_OUT,
        reference: `Cheque ${d.chequeNumber}${d.bank ? ` · ${d.bank}` : ""} due ${d.dueDate}`, notes: d.notes, createdById: user.id,
      },
    });
    await postSupplierPayment(tx, { id: payment.id, companyId, number, amount, paidAt: date, moneyAccountId: a.CHEQUES_OUT, supplierId: purchase.supplierId, supplierName: purchase.supplier.name, invoiceNumber: purchase.invoiceNumber, createdById: user.id });
    await tx.cheque.create({
      data: {
        companyId, number: await nextNumber(tx, companyId, "CQ", date.getUTCFullYear()), direction: "ISSUED", chequeNumber: d.chequeNumber, bank: d.bank,
        partyName: purchase.supplier.name, supplierId: purchase.supplierId, amount, issueDate: date, dueDate: toDate(d.dueDate), status: "ISSUED", supplierPaymentId: payment.id, notes: d.notes, createdById: user.id,
      },
    });
  }, TRANSACTION_OPTIONS);
  refresh(companyId);
  redirect(`/c/${slug}/finance/cheques?view=issued&saved=1`);
}

/** Handed to the bank (received cheques only). Nothing changes in the accounts until it clears. */
export async function depositCheque(companySlug: string, chequeId: string): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  const done = await prisma.cheque.updateMany({ where: { id: chequeId, companyId, direction: "RECEIVED", status: "IN_HAND" }, data: { status: "DEPOSITED" } });
  if (!done.count) return { error: "Only a cheque in hand can be deposited." };
  refresh(companyId);
  return {};
}

const clearSchema = z.object({ date: day, bankAccountId: z.string().min(1, "Choose the bank account") });

/** The bank paid the cheque: the money moves to (or out of) the bank account. */
export async function clearCheque(companySlug: string, chequeId: string, _prev: ChequeFormState, formData: FormData): Promise<ChequeFormState> {
  const { user, slug, companyId } = await ctx(companySlug);
  const parsed = clearSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const bank = await prisma.ledgerAccount.findFirst({ where: { id: parsed.data.bankAccountId, companyId, kind: { in: ["BANK", "CASH"] }, active: true }, select: { id: true } });
  if (!bank) return { error: "Choose a bank account of this company." };
  try {
    await prisma.$transaction(async (tx) => {
      const c = await tx.cheque.findFirst({ where: { id: chequeId, companyId } });
      if (!c) throw new UserError("This cheque no longer exists.");
      if (!["IN_HAND", "DEPOSITED", "ISSUED"].includes(c.status)) throw new UserError("This cheque is already settled.");
      const date = toDate(parsed.data.date);
      await tx.cheque.update({ where: { id: c.id }, data: { status: "CLEARED", clearedAt: date, bankAccountId: bank.id } });
      await postChequeCleared(tx, {
        id: c.id, companyId, number: c.number, chequeNumber: c.chequeNumber, direction: c.direction as "RECEIVED" | "ISSUED",
        partyName: c.partyName, amount: Number(c.amount), date, bankAccountId: bank.id, createdById: user.id,
      });
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  refresh(companyId);
  redirect(`/c/${slug}/finance/cheques?cleared=1`);
}

/**
 * Bounced (or cancelled / given back): the payment it made is undone with reversing entries, so
 * the invoice or supplier bill is open again. A cleared cheque that bounces also reverses the bank.
 */
export async function bounceCheque(companySlug: string, chequeId: string, outcome: "BOUNCED" | "CANCELLED"): Promise<{ error?: string }> {
  const { user, companyId } = await ctx(companySlug);
  try {
    await prisma.$transaction(async (tx) => {
      const c = await tx.cheque.findFirst({ where: { id: chequeId, companyId } });
      if (!c) throw new UserError("This cheque no longer exists.");
      if (c.status === "BOUNCED" || c.status === "CANCELLED") throw new UserError("Already done.");
      if (outcome === "CANCELLED" && c.status === "CLEARED") throw new UserError("A cleared cheque can't be cancelled; mark it as bounced if the bank returned it.");
      const date = toDate(businessToday());
      const memo = `Cheque ${c.chequeNumber} ${outcome === "BOUNCED" ? "bounced" : "cancelled"} · ${c.number}`;
      if (c.status === "CLEARED") await reverseEntries(tx, "CHEQUE", c.id, date, user.id, memo);
      if (c.receiptId) {
        const receipt = await tx.customerReceipt.findUnique({ where: { id: c.receiptId }, select: { invoiceId: true } });
        await reverseEntries(tx, "RECEIPT", c.receiptId, date, user.id, memo);
        await tx.cheque.update({ where: { id: c.id }, data: { receiptId: null } });
        await tx.customerReceipt.delete({ where: { id: c.receiptId } });
        if (receipt?.invoiceId) await refreshInvoiceStatus(tx, receipt.invoiceId);
      }
      if (c.supplierPaymentId) {
        await reverseEntries(tx, "SUPPLIER_PAYMENT", c.supplierPaymentId, date, user.id, memo);
        await tx.cheque.update({ where: { id: c.id }, data: { supplierPaymentId: null } });
        await tx.supplierPayment.delete({ where: { id: c.supplierPaymentId } });
      }
      await tx.cheque.update({ where: { id: c.id }, data: { status: outcome, notes: [c.notes, `${outcome === "BOUNCED" ? "Bounced" : "Cancelled"} on ${businessToday()}`].filter(Boolean).join("\n") } });
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  refresh(companyId);
  return {};
}
