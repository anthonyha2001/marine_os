"use server";

import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { isPaymentMethod } from "@/lib/accounting";
import { businessToday } from "@/lib/dates";
import { companyIdFor } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import { salesTags } from "@/lib/data/sales";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { invoiceBalance, refreshInvoiceStatus } from "@/lib/ledger/invoice-status";
import { nextNumber } from "@/lib/ledger/numbering";
import { UnbalancedEntryError, postCreditNote, postEntry, postReceipt, postVoucher, removeEntries, reverseEntries } from "@/lib/ledger/posting";
import { VAT_RATE, round2 } from "@/lib/money";

export type FinanceFormState = { error?: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const toDate = (d: string) => new Date(`${d}T00:00:00Z`);

function refresh(companyId: string, invoices = false) {
  updateTag(ledgerTag(companyId));
  if (invoices) updateTag(salesTags.invoices(companyId));
}

async function moneyAccount(companyId: string, id: string) {
  return prisma.ledgerAccount.findFirst({ where: { id, companyId, kind: { in: ["CASH", "BANK"] }, active: true }, select: { id: true, name: true } });
}

// ── Customer receipts ──

const receiptSchema = z.object({
  invoiceId: z.string().optional().transform((v) => v || null),
  customerId: z.string().optional().transform((v) => v || null),
  amount: z.coerce.number({ message: "Enter an amount" }).positive("The amount must be more than 0"),
  receivedAt: date,
  method: z.string().refine(isPaymentMethod, "Choose how it was paid"),
  moneyAccountId: z.string().min(1, "Choose the cash box or bank account it was paid into"),
  reference: optionalText(200),
  notes: optionalText(2000),
  returnTo: z.string().optional(),
});

/** Money received from a customer: against an invoice (partial allowed) or on account. */
export async function recordReceipt(companySlug: string, _prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const { user, slug } = await requireModule(companySlug, "invoices");
  const parsed = receiptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const companyId = await companyIdFor(slug);

  const account = await moneyAccount(companyId, data.moneyAccountId);
  if (!account) return { error: "Choose a cash box or bank account of this company." };

  let invoice: { id: string; number: string; customerId: string | null; customerName: string } | null = null;
  let customer: { id: string | null; name: string };
  if (data.invoiceId) {
    invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, companyId, status: { not: "CANCELLED" } },
      select: { id: true, number: true, customerId: true, customerName: true },
    });
    if (!invoice) return { error: "That invoice no longer exists or is cancelled." };
    customer = { id: invoice.customerId, name: invoice.customerName };
  } else {
    const c = data.customerId ? await prisma.customer.findUnique({ where: { id: data.customerId }, select: { id: true, name: true } }) : null;
    if (!c) return { error: "Choose the invoice or the customer this payment is from." };
    customer = c;
  }

  const amount = round2(data.amount);
  const receivedAt = toDate(data.receivedAt);
  try {
    await prisma.$transaction(async (tx) => {
      if (invoice) {
        const bal = await invoiceBalance(tx, invoice.id);
        if (!bal || bal.balance <= 0) throw new UserError(`Invoice ${invoice.number} is already fully paid.`);
        if (amount > bal.balance + 0.005) throw new UserError(`Only ${money.format(bal.balance)} is left to pay on invoice ${invoice.number}.`);
      }
      const number = await nextNumber(tx, companyId, "RC", receivedAt.getUTCFullYear());
      const receipt = await tx.customerReceipt.create({
        select: { id: true },
        data: {
          companyId,
          number,
          invoiceId: invoice?.id ?? null,
          customerId: customer.id,
          customerName: customer.name,
          amount,
          receivedAt,
          method: data.method,
          moneyAccountId: account.id,
          reference: data.reference,
          notes: data.notes,
          createdById: user.id,
        },
      });
      await postReceipt(tx, {
        id: receipt.id,
        companyId,
        number,
        amount,
        receivedAt,
        moneyAccountId: account.id,
        customerId: customer.id,
        customerName: customer.name,
        invoiceNumber: invoice?.number ?? null,
        createdById: user.id,
      });
      if (invoice) await refreshInvoiceStatus(tx, invoice.id);
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }

  refresh(companyId, true);
  const back = data.returnTo === "invoice" && invoice ? `/c/${slug}/invoices/${invoice.id}?paid=1` : `/c/${slug}/finance/receipts?saved=1`;
  redirect(back);
}

export async function deleteReceipt(companySlug: string, receiptId: string): Promise<{ error?: string }> {
  const { slug } = await requireModule(companySlug, "invoices");
  const companyId = await companyIdFor(slug);
  const receipt = await prisma.customerReceipt.findFirst({ where: { id: receiptId, companyId }, select: { invoiceId: true } });
  if (!receipt) return { error: "This receipt no longer exists." };
  await prisma.$transaction(async (tx) => {
    await removeEntries(tx, "RECEIPT", receiptId);
    await tx.customerReceipt.delete({ where: { id: receiptId } });
    if (receipt.invoiceId) await refreshInvoiceStatus(tx, receipt.invoiceId);
  }, TRANSACTION_OPTIONS);
  refresh(companyId, true);
  return {};
}

// ── Vouchers: PV (pay an expense / anything), RV (cash in), TR (transfer) ──

const voucherSchema = z.object({
  kind: z.enum(["PAYMENT", "RECEIPT", "TRANSFER"]),
  date,
  moneyAccountId: z.string().min(1, "Choose the cash box or bank account"),
  counterAccountId: z.string().min(1, "Choose the account"),
  partyName: optionalText(200),
  description: z.string().trim().min(2, "Enter a description").max(500),
  amount: z.coerce.number({ message: "Enter an amount" }).positive("The amount must be more than 0"),
  withVat: z.string().optional(), // PV: amount includes recoverable VAT
  method: z.string().refine(isPaymentMethod, "Choose the payment method"),
  reference: optionalText(200),
});

const PREFIX = { PAYMENT: "PV", RECEIPT: "RV", TRANSFER: "TR" } as const;

export async function createVoucher(companySlug: string, _prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const { user, slug } = await requireModule(companySlug, "accounting");
  const parsed = voucherSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const companyId = await companyIdFor(slug);

  const [moneyAcc, counter] = await Promise.all([
    moneyAccount(companyId, data.moneyAccountId),
    prisma.ledgerAccount.findFirst({ where: { id: data.counterAccountId, companyId, active: true }, select: { id: true, kind: true, type: true } }),
  ]);
  if (!moneyAcc) return { error: "Choose a cash box or bank account of this company." };
  if (!counter) return { error: "That account no longer exists." };
  const counterIsMoney = counter.kind === "CASH" || counter.kind === "BANK";
  if (data.kind === "TRANSFER" && (!counterIsMoney || counter.id === moneyAcc.id)) return { error: "Transfer to a different cash box or bank account." };
  if (data.kind !== "TRANSFER" && counterIsMoney) return { error: "To move money between cash and bank, use a transfer." };
  if (data.kind !== "TRANSFER" && (counter.kind === "RECEIVABLE" || counter.kind === "PAYABLE")) {
    return { error: "Customer and supplier payments are recorded on the invoice or the supplier bill." };
  }

  const amount = round2(data.amount);
  const vatAmount = data.kind === "PAYMENT" && data.withVat === "on" ? round2(amount - amount / (1 + VAT_RATE)) : 0;
  const amountHT = round2(amount - vatAmount);
  const when = toDate(data.date);

  const id = await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, companyId, PREFIX[data.kind], when.getUTCFullYear());
    const voucher = await tx.voucher.create({
      select: { id: true },
      data: {
        companyId,
        number,
        kind: data.kind,
        date: when,
        moneyAccountId: moneyAcc.id,
        counterAccountId: counter.id,
        partyName: data.partyName,
        description: data.description,
        amountHT,
        vatAmount,
        amount,
        method: data.method,
        reference: data.reference,
        createdById: user.id,
      },
    });
    await postVoucher(tx, {
      id: voucher.id,
      companyId,
      number,
      kind: data.kind,
      date: when,
      moneyAccountId: moneyAcc.id,
      counterAccountId: counter.id,
      partyName: data.partyName,
      description: data.description,
      amountHT,
      vatAmount,
      amount,
      createdById: user.id,
    });
    return voucher.id;
  }, TRANSACTION_OPTIONS);

  refresh(companyId);
  redirect(`/c/${slug}/finance/vouchers?saved=${id}`);
}

export async function deleteVoucher(companySlug: string, voucherId: string): Promise<{ error?: string }> {
  const { slug } = await requireModule(companySlug, "accounting");
  const companyId = await companyIdFor(slug);
  const voucher = await prisma.voucher.findFirst({ where: { id: voucherId, companyId }, select: { id: true } });
  if (!voucher) return { error: "This voucher no longer exists." };
  await prisma.$transaction(async (tx) => {
    await removeEntries(tx, "VOUCHER", voucherId);
    await tx.voucher.delete({ where: { id: voucherId } });
  }, TRANSACTION_OPTIONS);
  refresh(companyId);
  return {};
}

// ── Credit notes ──

const creditNoteSchema = z.object({
  invoiceId: z.string().min(1, "Choose the invoice to credit"),
  date,
  reason: z.string().trim().min(3, "Enter the reason for the credit note").max(500),
  lines: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Every line needs a description").max(300),
        quantity: z.number().positive("Quantities must be more than 0"),
        unitPrice: z.number().positive("Amounts must be more than 0"),
      }),
    )
    .min(1, "Add at least one line"),
});

export async function createCreditNote(companySlug: string, _prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const { user, slug } = await requireModule(companySlug, "invoices");
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = creditNoteSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const companyId = await companyIdFor(slug);

  const invoice = await prisma.invoice.findFirst({
    where: { id: data.invoiceId, companyId, status: { not: "CANCELLED" } },
    select: {
      id: true, number: true, applyVat: true, totalTTC: true, customerId: true, customerName: true, customerAddress: true, customerTaxNumber: true,
      creditNotes: { where: { status: "ISSUED" }, select: { totalTTC: true } },
    },
  });
  if (!invoice) return { error: "That invoice no longer exists or is cancelled." };

  const lines = data.lines.map((l, position) => ({ position, title: l.title, quantity: l.quantity, unitPrice: round2(l.unitPrice), lineTotal: round2(l.quantity * l.unitPrice) }));
  const totalHT = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const vatAmount = invoice.applyVat ? round2(totalHT * VAT_RATE) : 0;
  const totalTTC = round2(totalHT + vatAmount);
  const alreadyCredited = round2(invoice.creditNotes.reduce((s, c) => s + Number(c.totalTTC), 0));
  const creditable = round2(Number(invoice.totalTTC) - alreadyCredited);
  if (totalTTC > creditable + 0.005) return { error: `At most ${money.format(creditable)} can still be credited on invoice ${invoice.number}.` };

  const when = toDate(data.date);
  const id = await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, companyId, "CN", when.getUTCFullYear());
    const cn = await tx.creditNote.create({
      select: { id: true },
      data: {
        companyId, number, invoiceId: invoice.id, customerId: invoice.customerId, customerName: invoice.customerName,
        customerAddress: invoice.customerAddress, customerTaxNumber: invoice.customerTaxNumber, date: when, reason: data.reason,
        applyVat: invoice.applyVat, totalHT, vatAmount, totalTTC, createdById: user.id, lines: { create: lines },
      },
    });
    await postCreditNote(tx, {
      id: cn.id, companyId, number, date: when, customerId: invoice.customerId, customerName: invoice.customerName, totalHT, vatAmount, totalTTC, createdById: user.id,
    });
    await refreshInvoiceStatus(tx, invoice.id);
    return cn.id;
  }, TRANSACTION_OPTIONS);

  refresh(companyId, true);
  redirect(`/c/${slug}/finance/credit-notes/${id}?saved=1`);
}

export async function cancelCreditNote(companySlug: string, creditNoteId: string): Promise<{ error?: string }> {
  const { user, slug } = await requireModule(companySlug, "invoices");
  const companyId = await companyIdFor(slug);
  const cn = await prisma.creditNote.findFirst({ where: { id: creditNoteId, companyId }, select: { number: true, status: true, invoiceId: true } });
  if (!cn) return { error: "This credit note no longer exists." };
  if (cn.status === "CANCELLED") return {};
  await prisma.$transaction(async (tx) => {
    await tx.creditNote.update({ where: { id: creditNoteId }, data: { status: "CANCELLED" } });
    await reverseEntries(tx, "CREDIT_NOTE", creditNoteId, toDate(businessToday()), user.id, `Credit note ${cn.number} cancelled`);
    if (cn.invoiceId) await refreshInvoiceStatus(tx, cn.invoiceId);
  }, TRANSACTION_OPTIONS);
  refresh(companyId, true);
  return {};
}

// ── Chart of accounts ──

const accountSchema = z.object({
  code: z.string().trim().regex(/^\d{2,8}$/, "Account codes are 2–8 digits"),
  name: z.string().trim().min(2, "Enter the account name").max(120),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
  kind: z.enum(["CASH", "BANK", "EXPENSE", "INCOME", "OTHER"]),
});

export async function saveLedgerAccount(companySlug: string, accountId: string | null, _prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const { slug } = await requireModule(companySlug, "accounting");
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  // Cash and bank accounts are assets; keep the kind consistent with the type.
  if ((data.kind === "CASH" || data.kind === "BANK") && data.type !== "ASSET") return { error: "Cash and bank accounts must be assets." };
  if (data.kind === "EXPENSE" && data.type !== "EXPENSE") return { error: "Expense accounts must have the type Expense." };
  if (data.kind === "INCOME" && data.type !== "INCOME") return { error: "Income accounts must have the type Income." };
  const companyId = await companyIdFor(slug);
  try {
    if (accountId) {
      const existing = await prisma.ledgerAccount.findFirst({ where: { id: accountId, companyId }, select: { isSystem: true } });
      if (!existing) return { error: "This account no longer exists." };
      // System accounts keep their code and nature; only the name can change.
      await prisma.ledgerAccount.update({
        where: { id: accountId },
        data: existing.isSystem ? { name: data.name } : { code: data.code, name: data.name, type: data.type, kind: data.kind },
      });
    } else {
      await prisma.ledgerAccount.create({ data: { companyId, code: data.code, name: data.name, type: data.type, kind: data.kind } });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: `Account ${data.code} already exists.` };
    throw e;
  }
  refresh(companyId);
  redirect(`/c/${slug}/finance/accounts?saved=1`);
}

export async function deleteLedgerAccount(companySlug: string, accountId: string): Promise<{ error?: string }> {
  const { slug } = await requireModule(companySlug, "accounting");
  const companyId = await companyIdFor(slug);
  const account = await prisma.ledgerAccount.findFirst({
    where: { id: accountId, companyId },
    select: { isSystem: true, _count: { select: { lines: true, receipts: true, supplierPayments: true, voucherMoney: true, voucherCounterpart: true } } },
  });
  if (!account) return { error: "This account no longer exists." };
  if (account.isSystem) return { error: "This account is used by automatic postings and can't be deleted." };
  const used = Object.values(account._count).some((n) => n > 0);
  if (used) {
    // Keep the history: an account with entries is deactivated instead of deleted.
    await prisma.ledgerAccount.update({ where: { id: accountId }, data: { active: false } });
  } else {
    await prisma.ledgerAccount.delete({ where: { id: accountId } });
  }
  refresh(companyId);
  return {};
}

// ── Manual journal entries ──

const journalSchema = z.object({
  date,
  memo: z.string().trim().min(3, "Describe the entry").max(300),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1, "Choose an account on every line"),
        debit: z.number().min(0),
        credit: z.number().min(0),
        description: z.string().trim().max(300).optional(),
      }),
    )
    .min(2, "A journal entry needs at least two lines"),
});

export async function createJournalEntry(companySlug: string, _prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const { user, slug } = await requireModule(companySlug, "accounting");
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = journalSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const companyId = await companyIdFor(slug);
  const ids = [...new Set(data.lines.map((l) => l.accountId))];
  const count = await prisma.ledgerAccount.count({ where: { id: { in: ids }, companyId } });
  if (count !== ids.length) return { error: "One of the accounts doesn't belong to this company." };
  if (data.lines.some((l) => l.debit > 0 && l.credit > 0)) return { error: "A line has either a debit or a credit, not both." };

  try {
    await prisma.$transaction(
      (tx) =>
        postEntry(tx, {
          companyId,
          date: toDate(data.date),
          memo: data.memo,
          sourceType: "MANUAL",
          createdById: user.id,
          lines: data.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description || null })),
        }),
      TRANSACTION_OPTIONS,
    );
  } catch (e) {
    if (e instanceof UnbalancedEntryError) return { error: "Debits and credits must be equal." };
    throw e;
  }
  refresh(companyId);
  redirect(`/c/${slug}/finance/journal?saved=1`);
}

export async function deleteJournalEntry(companySlug: string, entryId: string): Promise<{ error?: string }> {
  const { slug } = await requireModule(companySlug, "accounting");
  const companyId = await companyIdFor(slug);
  const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, companyId }, select: { sourceType: true } });
  if (!entry) return { error: "This entry no longer exists." };
  if (entry.sourceType !== "MANUAL") return { error: "Automatic entries are changed through their document (invoice, payment, voucher…)." };
  await prisma.journalEntry.delete({ where: { id: entryId } });
  refresh(companyId);
  return {};
}

class UserError extends Error {}
