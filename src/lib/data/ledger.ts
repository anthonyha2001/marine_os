import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import { listInvoices } from "@/lib/data/sales";
import { syncLedger } from "@/lib/ledger/posting";
import type { CompanySlug } from "@/lib/permissions";
import { DATA_TAG } from "@/lib/cache-tag";

// The general ledger and financial documents, cached per company. Every posting action calls
// updateTag(ledgerTag(companyId)); reports are computed in memory from this data.
export const ledgerTag = (companyId: string) => `ledger:${companyId}`;

export type LedgerAccountRow = {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  kind: string;
  isSystem: boolean;
  active: boolean;
};

export type LedgerLineRow = {
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
  customerId: string | null;
  customerName: string | null;
  supplierId: string | null;
};

export type LedgerEntryRow = {
  id: string;
  number: string;
  date: Date;
  memo: string;
  sourceType: string;
  sourceId: string | null;
  reversalOf: string | null;
  createdByName: string;
  lines: LedgerLineRow[];
};

export type Ledger = { accounts: LedgerAccountRow[]; entries: LedgerEntryRow[] };

async function loadLedger(companyId: string): Promise<Ledger> {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  // Make sure documents created before the ledger existed are posted.
  await syncLedger(companyId);
  const [accounts, entries] = await Promise.all([
    prisma.ledgerAccount.findMany({ where: { companyId }, orderBy: { code: "asc" } }),
    prisma.journalEntry.findMany({
      where: { companyId },
      include: { lines: true, createdBy: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { number: "asc" }],
    }),
  ]);
  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type as LedgerAccountRow["type"],
      kind: a.kind,
      isSystem: a.isSystem,
      active: a.active,
    })),
    entries: entries.map((e) => ({
      id: e.id,
      number: e.number,
      date: e.date,
      memo: e.memo,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      reversalOf: e.reversalOf,
      createdByName: e.createdBy.name,
      lines: e.lines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit),
        credit: Number(l.credit),
        description: l.description,
        customerId: l.customerId,
        customerName: l.customerName,
        supplierId: l.supplierId,
      })),
    })),
  };
}

export async function getLedger(slug: CompanySlug) {
  return loadLedger(await companyIdFor(slug));
}

async function loadReceipts(companyId: string) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  const rows = await prisma.customerReceipt.findMany({
    where: { companyId },
    include: { invoice: { select: { id: true, number: true } }, moneyAccount: { select: { code: true, name: true } }, createdBy: { select: { name: true } } },
    orderBy: [{ receivedAt: "desc" }, { number: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    invoice: r.invoice,
    customerId: r.customerId,
    customerName: r.customerName,
    amount: Number(r.amount),
    receivedAt: r.receivedAt,
    method: r.method,
    moneyAccount: `${r.moneyAccount.code} ${r.moneyAccount.name}`,
    reference: r.reference,
    notes: r.notes,
    createdByName: r.createdBy.name,
    status: r.status as "POSTED" | "CANCELLED",
    cancelReason: r.cancelReason,
    cancelledByName: r.cancelledByName,
  }));
}

export async function listReceipts(slug: CompanySlug) {
  return loadReceipts(await companyIdFor(slug));
}

async function loadVouchers(companyId: string) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  const [rows, supplierPayments, payable] = await Promise.all([
    prisma.voucher.findMany({
      where: { companyId },
      include: {
        moneyAccount: { select: { code: true, name: true } },
        counterAccount: { select: { code: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { number: "desc" }],
    }),
    prisma.supplierPayment.findMany({
      where: { companyId, number: { not: null } },
      include: {
        moneyAccount: { select: { code: true, name: true } },
        purchase: { select: { id: true, invoiceNumber: true, supplier: { select: { name: true } } } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.ledgerAccount.findFirst({ where: { companyId, kind: "PAYABLE" }, select: { code: true, name: true } }),
  ]);
  // Payments of supplier bills are payment vouchers too (PV series), recorded on the bill.
  const fromBills = supplierPayments.map((p) => ({
    id: p.id,
    number: p.number!,
    kind: "PAYMENT" as const,
    source: "SUPPLIER_PAYMENT" as const,
    purchaseId: p.purchase.id,
    date: p.paidAt,
    moneyAccount: p.moneyAccount ? `${p.moneyAccount.code} ${p.moneyAccount.name}` : "—",
    counterAccount: payable ? `${payable.code} ${payable.name}` : "Suppliers",
    partyName: p.purchase.supplier.name as string | null,
    description: `Payment of supplier invoice ${p.purchase.invoiceNumber}${p.notes ? ` · ${p.notes}` : ""}`,
    amountHT: Number(p.amount),
    vatAmount: 0,
    amount: Number(p.amount),
    method: p.method,
    reference: p.reference,
    createdByName: p.createdBy.name,
    createdAt: p.createdAt,
    status: p.status as "POSTED" | "CANCELLED",
    cancelReason: p.cancelReason,
    cancelledByName: p.cancelledByName,
  }));
  const vouchers = rows.map((v) => ({
    id: v.id,
    number: v.number,
    kind: v.kind as "PAYMENT" | "RECEIPT" | "TRANSFER",
    date: v.date,
    moneyAccount: `${v.moneyAccount.code} ${v.moneyAccount.name}`,
    counterAccount: `${v.counterAccount.code} ${v.counterAccount.name}`,
    partyName: v.partyName,
    description: v.description,
    amountHT: Number(v.amountHT),
    vatAmount: Number(v.vatAmount),
    amount: Number(v.amount),
    method: v.method,
    reference: v.reference,
    createdByName: v.createdBy.name,
    createdAt: v.createdAt,
    source: "VOUCHER" as "VOUCHER" | "SUPPLIER_PAYMENT",
    status: v.status as "POSTED" | "CANCELLED",
    cancelReason: v.cancelReason,
    cancelledByName: v.cancelledByName,
    purchaseId: null as string | null,
  }));
  return [...vouchers, ...fromBills].sort((a, b) => b.date.getTime() - a.date.getTime() || b.number.localeCompare(a.number));
}

export async function listVouchers(slug: CompanySlug) {
  return loadVouchers(await companyIdFor(slug));
}

export type VoucherRow = Awaited<ReturnType<typeof loadVouchers>>[number];

async function loadCreditNotes(companyId: string) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  const rows = await prisma.creditNote.findMany({
    where: { companyId },
    include: { invoice: { select: { id: true, number: true } }, lines: { orderBy: { position: "asc" } }, createdBy: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { number: "desc" }],
  });
  return rows.map((c) => ({
    id: c.id,
    number: c.number,
    invoice: c.invoice,
    customerId: c.customerId,
    customerName: c.customerName,
    customerAddress: c.customerAddress,
    customerTaxNumber: c.customerTaxNumber,
    date: c.date,
    reason: c.reason,
    status: c.status as "ISSUED" | "CANCELLED",
    applyVat: c.applyVat,
    totalHT: Number(c.totalHT),
    vatAmount: Number(c.vatAmount),
    totalTTC: Number(c.totalTTC),
    createdByName: c.createdBy.name,
    lines: c.lines.map((l) => ({ id: l.id, title: l.title, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), lineTotal: Number(l.lineTotal) })),
  }));
}

export async function listCreditNotes(slug: CompanySlug) {
  return loadCreditNotes(await companyIdFor(slug));
}

export type CreditNoteRow = Awaited<ReturnType<typeof loadCreditNotes>>[number];

/** Paid and credited amounts per invoice (for balances and progress bars). */
export async function invoiceSettlements(slug: CompanySlug) {
  const [receipts, notes] = await Promise.all([listReceipts(slug), listCreditNotes(slug)]);
  const map = new Map<string, { paid: number; credited: number }>();
  for (const r of receipts) {
    if (!r.invoice || r.status !== "POSTED") continue;
    const m = map.get(r.invoice.id) ?? { paid: 0, credited: 0 };
    m.paid += r.amount;
    map.set(r.invoice.id, m);
  }
  for (const c of notes) {
    if (!c.invoice || c.status !== "ISSUED") continue;
    const m = map.get(c.invoice.id) ?? { paid: 0, credited: 0 };
    m.credited += c.totalTTC;
    map.set(c.invoice.id, m);
  }
  return map;
}

export type MoneyAccountOption = { id: string; code: string; name: string; kind: "CASH" | "BANK" };

/** Active cash boxes and bank accounts, for "paid from / paid into" selects. */
export async function listMoneyAccounts(slug: CompanySlug): Promise<MoneyAccountOption[]> {
  const { accounts } = await getLedger(slug);
  return accounts
    .filter((a) => a.active && (a.kind === "CASH" || a.kind === "BANK"))
    .map((a) => ({ id: a.id, code: a.code, name: a.name, kind: a.kind as "CASH" | "BANK" }));
}

/** Invoices with what was paid, credited and is still due (cancelled ones excluded). */
export async function invoicesWithBalance(slug: CompanySlug) {
  const [invoices, settled] = await Promise.all([listInvoices(slug), invoiceSettlements(slug)]);
  return invoices
    .filter((i) => i.status !== "CANCELLED")
    .map((i) => {
      const s = settled.get(i.id) ?? { paid: 0, credited: 0 };
      const paid = Math.round(s.paid * 100) / 100;
      const credited = Math.round(s.credited * 100) / 100;
      return { ...i, paid, credited, balance: Math.max(0, Math.round((i.totalTTC - paid - credited) * 100) / 100) };
    });
}

export type InvoiceWithBalance = Awaited<ReturnType<typeof invoicesWithBalance>>[number];

export type CustomerBalance = { due: number; overdue: number; unpaidCount: number };

/**
 * What each customer owes this company: open invoice balances (after receipts and credit
 * notes), and the part past its due date. Keyed by customer id, or "name:<name>" for
 * invoices to customers that were never saved.
 */
export async function customerBalances(slug: CompanySlug) {
  const today = new Date().toISOString().slice(0, 10);
  const balances = new Map<string, CustomerBalance>();
  for (const inv of await invoicesWithBalance(slug)) {
    if (inv.balance <= 0) continue;
    const key = inv.customerId ?? `name:${inv.customerName.trim().toLowerCase()}`;
    const b = balances.get(key) ?? { due: 0, overdue: 0, unpaidCount: 0 };
    b.due += inv.balance;
    b.unpaidCount += 1;
    if (inv.dueDate.toISOString().slice(0, 10) < today) b.overdue += inv.balance;
    balances.set(key, b);
  }
  return balances;
}

/** Invoices that can still be credited, with their lines (for the credit note form). */
export async function listCreditableInvoices(slug: CompanySlug) {
  const companyId = await companyIdFor(slug);
  const rows = await prisma.invoice.findMany({
    where: { companyId, status: { not: "CANCELLED" } },
    select: {
      id: true,
      number: true,
      customerName: true,
      applyVat: true,
      totalTTC: true,
      lines: { orderBy: { position: "asc" }, select: { title: true, quantity: true, unitPrice: true } },
      creditNotes: { where: { status: "ISSUED" }, select: { totalTTC: true } },
    },
    orderBy: [{ invoiceDate: "desc" }, { number: "desc" }],
  });
  return rows
    .map((i) => ({
      id: i.id,
      number: i.number,
      customerName: i.customerName,
      applyVat: i.applyVat,
      totalTTC: Number(i.totalTTC),
      creditable: Math.round((Number(i.totalTTC) - i.creditNotes.reduce((s, c) => s + Number(c.totalTTC), 0)) * 100) / 100,
      lines: i.lines.map((l) => ({ title: l.title, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
    }))
    .filter((i) => i.creditable > 0);
}
