import "server-only";
import { prisma, type Tx } from "@/lib/prisma";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { round2 } from "@/lib/money";
import { systemAccounts } from "./chart";
import { nextNumber } from "./numbering";

// Double-entry postings. Every business document calls one of these inside its own
// transaction, so the document and its journal entry are saved together or not at all.

export type SourceType =
  | "INVOICE"
  | "CREDIT_NOTE"
  | "PURCHASE"
  | "SUPPLIER_PAYMENT"
  | "RECEIPT"
  | "VOUCHER"
  | "MANUAL"
  | "REVERSAL"
  | "POS_SALE"
  | "POS_REFUND"
  | "POS_SHIFT"
  | "PAYROLL"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "CHEQUE";

export type PostingLine = {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  supplierId?: string | null;
};

export class UnbalancedEntryError extends Error {}

type EntryInput = {
  companyId: string;
  date: Date;
  memo: string;
  sourceType: SourceType;
  sourceId?: string | null;
  reversalOf?: string | null;
  createdById: string;
  lines: PostingLine[];
};

/** Create a balanced journal entry (debits = credits), numbered JV-YYYY-00001. */
export async function postEntry(tx: Tx, input: EntryInput) {
  const lines = input.lines
    .map((l) => ({ ...l, debit: round2(l.debit ?? 0), credit: round2(l.credit ?? 0) }))
    .filter((l) => l.debit !== 0 || l.credit !== 0);
  const debit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (lines.length < 2 || Math.abs(debit - credit) >= 0.005) {
    throw new UnbalancedEntryError(`Journal entry is not balanced (debit ${debit}, credit ${credit}).`);
  }
  return tx.journalEntry.create({
    select: { id: true, number: true },
    data: {
      companyId: input.companyId,
      number: await nextNumber(tx, input.companyId, "JV", input.date.getUTCFullYear(), 5),
      date: input.date,
      memo: input.memo,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      reversalOf: input.reversalOf ?? null,
      createdById: input.createdById,
      lines: {
        create: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description ?? null,
          customerId: l.customerId ?? null,
          customerName: l.customerName ?? null,
          supplierId: l.supplierId ?? null,
        })),
      },
    },
  });
}

/** Delete the entries of a document that is itself being deleted (e.g. a payment entered by mistake). */
export async function removeEntries(tx: Tx, sourceType: SourceType, sourceId: string) {
  await tx.journalEntry.deleteMany({ where: { sourceType, sourceId } });
}

/** Post the mirror image of a document's entries (cancellations keep a full audit trail). */
export async function reverseEntries(tx: Tx, sourceType: SourceType, sourceId: string, date: Date, createdById: string, memo: string) {
  const entries = await tx.journalEntry.findMany({ where: { sourceType, sourceId }, include: { lines: true } });
  for (const entry of entries) {
    const already = await tx.journalEntry.count({ where: { reversalOf: entry.id } });
    if (already) continue;
    await postEntry(tx, {
      companyId: entry.companyId,
      date,
      memo: `${memo} (reverses ${entry.number})`,
      sourceType: "REVERSAL",
      sourceId,
      reversalOf: entry.id,
      createdById,
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
  }
}

// ── Document postings ──

type InvoiceLike = {
  id: string;
  companyId: string;
  number: string;
  invoiceDate: Date;
  customerId: string | null;
  customerName: string;
  totalHT: number;
  vatAmount: number;
  totalTTC: number;
  createdById: string;
};

/** Invoice: Dr Customers (TTC) / Cr Sales (HT) + Cr VAT collected. */
export async function postInvoice(tx: Tx, inv: InvoiceLike) {
  const a = await systemAccounts(inv.companyId, tx);
  const partner = { customerId: inv.customerId, customerName: inv.customerName };
  return postEntry(tx, {
    companyId: inv.companyId,
    date: inv.invoiceDate,
    memo: `Invoice ${inv.number} · ${inv.customerName}`,
    sourceType: "INVOICE",
    sourceId: inv.id,
    createdById: inv.createdById,
    lines: [
      { accountId: a.RECEIVABLE, debit: inv.totalTTC, description: `Invoice ${inv.number}`, ...partner },
      { accountId: a.SALES, credit: inv.totalHT, description: `Invoice ${inv.number}` },
      { accountId: a.VAT_OUT, credit: inv.vatAmount, description: `VAT on invoice ${inv.number}` },
    ],
  });
}

/** Credit note: Dr Sales (HT) + Dr VAT collected / Cr Customers (TTC). */
export async function postCreditNote(
  tx: Tx,
  cn: { id: string; companyId: string; number: string; date: Date; customerId: string | null; customerName: string; totalHT: number; vatAmount: number; totalTTC: number; createdById: string },
) {
  const a = await systemAccounts(cn.companyId, tx);
  return postEntry(tx, {
    companyId: cn.companyId,
    date: cn.date,
    memo: `Credit note ${cn.number} · ${cn.customerName}`,
    sourceType: "CREDIT_NOTE",
    sourceId: cn.id,
    createdById: cn.createdById,
    lines: [
      { accountId: a.SALES, debit: cn.totalHT, description: `Credit note ${cn.number}` },
      { accountId: a.VAT_OUT, debit: cn.vatAmount, description: `VAT on credit note ${cn.number}` },
      { accountId: a.RECEIVABLE, credit: cn.totalTTC, description: `Credit note ${cn.number}`, customerId: cn.customerId, customerName: cn.customerName },
    ],
  });
}

/** Purchase (supplier bill): Dr Purchases (HT) + Dr VAT recoverable / Cr Suppliers (TTC). */
export async function postPurchase(
  tx: Tx,
  p: { id: string; companyId: string; invoiceNumber: string; purchaseDate: Date; supplierId: string; supplierName: string; totalHT: number; vatAmount: number; totalTTC: number; createdById: string },
) {
  const a = await systemAccounts(p.companyId, tx);
  return postEntry(tx, {
    companyId: p.companyId,
    date: p.purchaseDate,
    memo: `Supplier invoice ${p.invoiceNumber} · ${p.supplierName}`,
    sourceType: "PURCHASE",
    sourceId: p.id,
    createdById: p.createdById,
    lines: [
      { accountId: a.PURCHASES, debit: p.totalHT, description: `Supplier invoice ${p.invoiceNumber}` },
      { accountId: a.VAT_IN, debit: p.vatAmount, description: `VAT on supplier invoice ${p.invoiceNumber}` },
      { accountId: a.PAYABLE, credit: p.totalTTC, description: `Supplier invoice ${p.invoiceNumber}`, supplierId: p.supplierId },
    ],
  });
}

/** Supplier payment: Dr Suppliers / Cr Cash or Bank. */
export async function postSupplierPayment(
  tx: Tx,
  p: { id: string; companyId: string; number?: string | null; amount: number; paidAt: Date; moneyAccountId: string; supplierId: string; supplierName: string; invoiceNumber: string; createdById: string },
) {
  const a = await systemAccounts(p.companyId, tx);
  return postEntry(tx, {
    companyId: p.companyId,
    date: p.paidAt,
    memo: `${p.number ? `Payment voucher ${p.number} · ` : "Payment to "}${p.supplierName} · invoice ${p.invoiceNumber}`,
    sourceType: "SUPPLIER_PAYMENT",
    sourceId: p.id,
    createdById: p.createdById,
    lines: [
      { accountId: a.PAYABLE, debit: p.amount, description: `Payment · invoice ${p.invoiceNumber}`, supplierId: p.supplierId },
      { accountId: p.moneyAccountId, credit: p.amount, description: `Payment to ${p.supplierName}` },
    ],
  });
}

/** Customer receipt: Dr Cash or Bank / Cr Customers. */
export async function postReceipt(
  tx: Tx,
  r: { id: string; companyId: string; number: string; amount: number; receivedAt: Date; moneyAccountId: string; customerId: string | null; customerName: string; invoiceNumber: string | null; createdById: string },
) {
  const a = await systemAccounts(r.companyId, tx);
  const what = r.invoiceNumber ? `invoice ${r.invoiceNumber}` : "on account";
  return postEntry(tx, {
    companyId: r.companyId,
    date: r.receivedAt,
    memo: `Receipt ${r.number} · ${r.customerName} · ${what}`,
    sourceType: "RECEIPT",
    sourceId: r.id,
    createdById: r.createdById,
    lines: [
      { accountId: r.moneyAccountId, debit: r.amount, description: `Receipt ${r.number} from ${r.customerName}` },
      { accountId: a.RECEIVABLE, credit: r.amount, description: `Receipt ${r.number} · ${what}`, customerId: r.customerId, customerName: r.customerName },
    ],
  });
}

/**
 * Vouchers. PV: Dr expense (HT) + Dr VAT recoverable / Cr cash-bank (total).
 * RV: Dr cash-bank / Cr counter account. TR: Dr destination / Cr source.
 */
export async function postVoucher(
  tx: Tx,
  v: {
    id: string;
    companyId: string;
    number: string;
    kind: "PAYMENT" | "RECEIPT" | "TRANSFER";
    date: Date;
    moneyAccountId: string;
    counterAccountId: string;
    partyName: string | null;
    description: string;
    amountHT: number;
    vatAmount: number;
    amount: number;
    createdById: string;
  },
) {
  const a = await systemAccounts(v.companyId, tx);
  const label = `${v.number} · ${v.description}${v.partyName ? ` · ${v.partyName}` : ""}`;
  const lines: PostingLine[] =
    v.kind === "PAYMENT"
      ? [
          { accountId: v.counterAccountId, debit: v.amountHT, description: label },
          { accountId: a.VAT_IN, debit: v.vatAmount, description: `VAT · ${v.number}` },
          { accountId: v.moneyAccountId, credit: v.amount, description: label },
        ]
      : v.kind === "RECEIPT"
        ? [
            { accountId: v.moneyAccountId, debit: v.amount, description: label },
            { accountId: v.counterAccountId, credit: v.amount, description: label },
          ]
        : [
            { accountId: v.counterAccountId, debit: v.amount, description: label },
            { accountId: v.moneyAccountId, credit: v.amount, description: label },
          ];
  return postEntry(tx, { companyId: v.companyId, date: v.date, memo: label, sourceType: "VOUCHER", sourceId: v.id, createdById: v.createdById, lines });
}

// ── Catch-up for documents created before the ledger existed ──

const synced = new Set<string>();

/**
 * Post any invoice, purchase or supplier payment that has no journal entry yet. Runs once per
 * company per server start (then documents post themselves), and on demand after imports.
 */
export async function syncLedger(companyId: string, force = false) {
  if (synced.has(companyId) && !force) return;
  const a = await systemAccounts(companyId);
  const posted = new Set(
    (await prisma.journalEntry.findMany({ where: { companyId, sourceId: { not: null } }, select: { sourceType: true, sourceId: true } })).map(
      (e) => `${e.sourceType}:${e.sourceId}`,
    ),
  );

  const [invoices, purchases, payments] = await Promise.all([
    prisma.invoice.findMany({ where: { companyId } }),
    prisma.purchase.findMany({ where: { companyId }, include: { supplier: { select: { name: true } } } }),
    prisma.supplierPayment.findMany({
      where: { companyId },
      include: { purchase: { select: { invoiceNumber: true, supplierId: true, supplier: { select: { name: true } } } } },
    }),
  ]);

  for (const inv of invoices.filter((i) => !posted.has(`INVOICE:${i.id}`))) {
    await prisma.$transaction(async (tx) => {
      await postInvoice(tx, {
        id: inv.id, companyId, number: inv.number, invoiceDate: inv.invoiceDate, customerId: inv.customerId, customerName: inv.customerName,
        totalHT: Number(inv.totalHT), vatAmount: Number(inv.vatAmount), totalTTC: Number(inv.totalTTC), createdById: inv.createdById,
      });
      if (inv.status === "CANCELLED") await reverseEntries(tx, "INVOICE", inv.id, inv.updatedAt, inv.createdById, `Invoice ${inv.number} cancelled`);
    }, TRANSACTION_OPTIONS);
  }
  for (const p of purchases.filter((x) => !posted.has(`PURCHASE:${x.id}`))) {
    await prisma.$transaction((tx) =>
      postPurchase(tx, {
        id: p.id, companyId, invoiceNumber: p.invoiceNumber, purchaseDate: p.purchaseDate, supplierId: p.supplierId, supplierName: p.supplier.name,
        totalHT: Number(p.totalHT), vatAmount: Number(p.vatAmount), totalTTC: Number(p.totalTTC), createdById: p.createdById,
      }),
      TRANSACTION_OPTIONS,
    );
  }
  for (const pay of payments.filter((x) => !posted.has(`SUPPLIER_PAYMENT:${x.id}`))) {
    await prisma.$transaction(async (tx) => {
      // Payments recorded before cash/bank accounts existed are assigned to Cash (530) if paid in cash, otherwise Bank (512).
      const moneyAccountId = pay.moneyAccountId ?? (pay.method === "CASH" ? a.CASH : a.BANK);
      if (!pay.moneyAccountId) await tx.supplierPayment.update({ where: { id: pay.id }, data: { moneyAccountId } });
      await postSupplierPayment(tx, {
        id: pay.id, companyId, amount: Number(pay.amount), paidAt: pay.paidAt, moneyAccountId,
        supplierId: pay.purchase.supplierId, supplierName: pay.purchase.supplier.name, invoiceNumber: pay.purchase.invoiceNumber, createdById: pay.createdById,
      });
    }, TRANSACTION_OPTIONS);
  }
  synced.add(companyId);
}

/**
 * Counter sale. Dr Cash (USD kept) + Dr Cash LBP (USD value of the LBP kept) + Dr Bank (card)
 * / Cr Sales (HT) + Cr VAT collected. The LBP part is whatever the USD and card part don't
 * cover, so the entry always balances.
 */
export async function postPosSale(
  tx: Tx,
  sale: {
    id: string;
    companyId: string;
    number: string;
    date: Date;
    customerId: string | null;
    customerName: string;
    totalHT: number;
    vatAmount: number;
    totalTTC: number;
    usdKept: number;
    lbpValue: number;
    card: number;
    createdById: string;
  },
) {
  const a = await systemAccounts(sale.companyId, tx);
  const label = `Counter sale ${sale.number}`;
  return postEntry(tx, {
    companyId: sale.companyId,
    date: sale.date,
    memo: `${label} · ${sale.customerName}`,
    sourceType: "POS_SALE",
    sourceId: sale.id,
    createdById: sale.createdById,
    lines: [
      { accountId: a.CASH, debit: Math.max(0, sale.usdKept), credit: Math.max(0, -sale.usdKept), description: label },
      { accountId: a.CASH_LBP, debit: Math.max(0, sale.lbpValue), credit: Math.max(0, -sale.lbpValue), description: label },
      { accountId: a.BANK, debit: sale.card, description: `${label} · card` },
      { accountId: a.SALES, credit: sale.totalHT, description: label },
      { accountId: a.VAT_OUT, credit: sale.vatAmount, description: label },
    ],
  });
}

/** Goods returned at the counter: Dr Sales + Dr VAT collected / Cr the till (or bank for card). */
export async function postPosRefund(
  tx: Tx,
  r: { id: string; companyId: string; number: string; saleNumber: string; date: Date; method: "CASH_USD" | "CASH_LBP" | "CARD"; totalHT: number; vatAmount: number; totalTTC: number; createdById: string },
) {
  const a = await systemAccounts(r.companyId, tx);
  const money = r.method === "CASH_USD" ? a.CASH : r.method === "CASH_LBP" ? a.CASH_LBP : a.BANK;
  const label = `Refund ${r.number} on ${r.saleNumber}`;
  return postEntry(tx, {
    companyId: r.companyId,
    date: r.date,
    memo: label,
    sourceType: "POS_REFUND",
    sourceId: r.id,
    createdById: r.createdById,
    lines: [
      { accountId: a.SALES, debit: r.totalHT, description: label },
      { accountId: a.VAT_OUT, debit: r.vatAmount, description: label },
      { accountId: money, credit: r.totalTTC, description: label },
    ],
  });
}

/**
 * Till count at closing. A shortage goes to Other expenses (658), a surplus to Other income
 * (758). The LBP difference is valued at the closing rate.
 */
export async function postShiftDifference(
  tx: Tx,
  s: { id: string; companyId: string; number: string; date: Date; usdDiff: number; lbpDiffValue: number; createdById: string },
) {
  if (Math.abs(s.usdDiff) < 0.005 && Math.abs(s.lbpDiffValue) < 0.005) return null;
  const a = await systemAccounts(s.companyId, tx);
  const others = await tx.ledgerAccount.findMany({ where: { companyId: s.companyId, code: { in: ["658", "758"] } }, select: { id: true, code: true } });
  const loss = others.find((o) => o.code === "658")?.id;
  const gain = others.find((o) => o.code === "758")?.id;
  if (!loss || !gain) throw new Error("Accounts 658 and 758 are missing from the chart of accounts.");
  const label = `Till difference · shift ${s.number}`;
  const total = round2(s.usdDiff + s.lbpDiffValue);
  return postEntry(tx, {
    companyId: s.companyId,
    date: s.date,
    memo: label,
    sourceType: "POS_SHIFT",
    sourceId: s.id,
    createdById: s.createdById,
    lines: [
      { accountId: a.CASH, debit: Math.max(0, s.usdDiff), credit: Math.max(0, -s.usdDiff), description: `${label} · USD` },
      { accountId: a.CASH_LBP, debit: Math.max(0, s.lbpDiffValue), credit: Math.max(0, -s.lbpDiffValue), description: `${label} · LBP` },
      total > 0 ? { accountId: gain, credit: total, description: label } : { accountId: loss, debit: -total, description: label },
    ],
  });
}

/**
 * Payroll paid: Dr Salaries and wages (each person's pay before advance repayments)
 * / Cr Staff advances (advances paid back) / Cr cash or bank (net paid out).
 */
export async function postPayroll(
  tx: Tx,
  run: {
    id: string;
    companyId: string;
    number: string;
    label: string;
    date: Date;
    moneyAccountId: string;
    lines: { name: string; gross: number; advance: number; net: number; nssfEmployee?: number; nssfEmployer?: number; incomeTax?: number }[];
    createdById: string;
  },
) {
  const a = await systemAccounts(run.companyId, tx);
  const memo = `Payroll ${run.number} · ${run.label}`;
  const advances = round2(run.lines.reduce((s, l) => s + l.advance, 0));
  const net = round2(run.lines.reduce((s, l) => s + l.net, 0));
  const employer = round2(run.lines.reduce((s, l) => s + (l.nssfEmployer ?? 0), 0));
  const nssf = round2(run.lines.reduce((s, l) => s + (l.nssfEmployee ?? 0), 0) + employer);
  const tax = round2(run.lines.reduce((s, l) => s + (l.incomeTax ?? 0), 0));
  return postEntry(tx, {
    companyId: run.companyId,
    date: run.date,
    memo,
    sourceType: "PAYROLL",
    sourceId: run.id,
    createdById: run.createdById,
    lines: [
      ...run.lines.map((l) => ({ accountId: a.SALARIES, debit: l.gross, description: `${l.name} · ${run.label}` })),
      { accountId: a.SOCIAL_COST, debit: employer, description: `Employer NSSF · ${run.label}` },
      { accountId: a.NSSF_PAYABLE, credit: nssf, description: `NSSF to pay (employee + employer) · ${run.label}` },
      { accountId: a.SALARY_TAX, credit: tax, description: `Income tax withheld · ${run.label}` },
      { accountId: a.STAFF_ADVANCES, credit: advances, description: `Advances paid back · ${run.label}` },
      { accountId: run.moneyAccountId, credit: net, description: memo },
    ],
  });
}

/**
 * Goods moved to / from the sister company, valued at cost (purchases are expensed when
 * bought, so the cost moves out of one company's purchases and into the other's).
 * Sender: Dr Sister company account (458) / Cr Purchases (601).
 * Receiver: Dr Purchases (601) / Cr Sister company account (458).
 */
export async function postTransfer(
  tx: Tx,
  t: { id: string; companyId: string; number: string; date: Date; direction: "OUT" | "IN"; otherCompany: string; amount: number; createdById: string },
) {
  if (t.amount <= 0) return null;
  const a = await systemAccounts(t.companyId, tx);
  const memo = `${t.direction === "OUT" ? "Goods sent to" : "Goods received from"} ${t.otherCompany} · ${t.number}`;
  return postEntry(tx, {
    companyId: t.companyId,
    date: t.date,
    memo,
    sourceType: t.direction === "OUT" ? "TRANSFER_OUT" : "TRANSFER_IN",
    sourceId: t.id,
    createdById: t.createdById,
    lines:
      t.direction === "OUT"
        ? [
            { accountId: a.INTERCOMPANY, debit: t.amount, description: memo },
            { accountId: a.PURCHASES, credit: t.amount, description: memo },
          ]
        : [
            { accountId: a.PURCHASES, debit: t.amount, description: memo },
            { accountId: a.INTERCOMPANY, credit: t.amount, description: memo },
          ],
  });
}

/**
 * A cheque paid by the bank. Received: Dr Bank / Cr Cheques to collect (5113).
 * Issued: Dr Cheques issued (403) / Cr Bank.
 */
export async function postChequeCleared(
  tx: Tx,
  c: { id: string; companyId: string; number: string; chequeNumber: string; direction: "RECEIVED" | "ISSUED"; partyName: string; amount: number; date: Date; bankAccountId: string; createdById: string },
) {
  const a = await systemAccounts(c.companyId, tx);
  const memo = `Cheque ${c.chequeNumber} ${c.direction === "RECEIVED" ? "from" : "to"} ${c.partyName} cleared · ${c.number}`;
  return postEntry(tx, {
    companyId: c.companyId,
    date: c.date,
    memo,
    sourceType: "CHEQUE",
    sourceId: c.id,
    createdById: c.createdById,
    lines:
      c.direction === "RECEIVED"
        ? [
            { accountId: c.bankAccountId, debit: c.amount, description: memo },
            { accountId: a.CHEQUES_IN, credit: c.amount, description: memo },
          ]
        : [
            { accountId: a.CHEQUES_OUT, debit: c.amount, description: memo },
            { accountId: c.bankAccountId, credit: c.amount, description: memo },
          ],
  });
}
