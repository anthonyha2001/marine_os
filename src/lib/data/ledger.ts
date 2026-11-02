import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentLbpRate } from "@/lib/lbp-rate";
import { companyIdFor } from "@/lib/data/inventory";
import { listInvoices } from "@/lib/data/sales";
import type { CompanySlug } from "@/lib/permissions";
import { DATA_TAG } from "@/lib/cache-tag";
import { round2 } from "@/lib/money";
import { moves, sumByAccount, sumByMonth, sumByPartner, vatDocuments, type MoveFilter } from "@/lib/ledger/queries";
import { accountTotalsFrom, debitNatured, withRunningBalance, type AccountTotal, type Partner, type PartnerBalance, type Period } from "@/lib/ledger/reports";

// The general ledger and financial documents, cached per company. Every posting action calls
// updateTag(ledgerTag(companyId)). Balances, statements and reports are summed in SQL.
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

export type JournalFilters = { from: string; to: string; source?: string; q?: string; page: number };

export const JOURNAL_PAGE_SIZE = 50;

// ── Reads summed in SQL (src/lib/ledger/queries.ts), cached per company ──

/** YYYY-MM-DD of a period bound (dates are stored as plain days). */
const dayOf = (d?: Date) => (d ? d.toISOString().slice(0, 10) : null);

async function loadAccounts(companyId: string): Promise<LedgerAccountRow[]> {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  const accounts = await prisma.ledgerAccount.findMany({ where: { companyId }, orderBy: { code: "asc" } });
  return accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type as LedgerAccountRow["type"],
    kind: a.kind,
    isSystem: a.isSystem,
    active: a.active,
  }));
}

/** The chart of accounts (active and inactive), by code. */
export async function getAccounts(slug: CompanySlug) {
  return loadAccounts(await companyIdFor(slug));
}

async function loadAccountSums(companyId: string, from: string | null, to: string | null) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  return sumByAccount(prisma, companyId, from, to);
}

/** Debit, credit and balance of every account over a period (or everything up to `to`). */
export async function getAccountTotals(slug: CompanySlug, period: Period = {}): Promise<AccountTotal[]> {
  const companyId = await companyIdFor(slug);
  const [accounts, sums] = await Promise.all([loadAccounts(companyId), loadAccountSums(companyId, dayOf(period.from), dayOf(period.to))]);
  return accountTotalsFrom(accounts, sums);
}

async function loadMonthlySums(companyId: string, from: string, to: string) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  return sumByMonth(prisma, companyId, from, to);
}

/** Account totals per month ("YYYY-MM") between two dates, in one query. */
export async function getMonthlyTotals(slug: CompanySlug, from: Date, to: Date): Promise<Map<string, AccountTotal[]>> {
  const companyId = await companyIdFor(slug);
  const [accounts, rows] = await Promise.all([loadAccounts(companyId), loadMonthlySums(companyId, dayOf(from)!, dayOf(to)!)]);
  const byMonth = new Map<string, typeof rows>();
  for (const r of rows) byMonth.set(r.month, [...(byMonth.get(r.month) ?? []), r]);
  return new Map([...byMonth].map(([month, sums]) => [month, accountTotalsFrom(accounts, sums)]));
}

async function loadMoves(companyId: string, filter: MoveFilter, from: string | null, to: string | null) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  return moves(prisma, companyId, filter, from, to);
}

/** General ledger of one account over a period, with running balance in its natural direction. */
export async function getAccountLedger(slug: CompanySlug, accountId: string, period: Period) {
  const companyId = await companyIdFor(slug);
  const account = (await loadAccounts(companyId)).find((a) => a.id === accountId);
  if (!account) return null;
  const { opening, rows } = await loadMoves(companyId, { kind: "account", accountId }, dayOf(period.from), dayOf(period.to));
  return { account, ...withRunningBalance(opening, rows, debitNatured(account.type) ? 1 : -1) };
}

/**
 * Statement of account. Customers: what they owe us (debit − credit on Customers 411).
 * Suppliers: what we owe them (credit − debit on Suppliers 401).
 */
export async function getStatement(slug: CompanySlug, partner: Partner, period: Period) {
  const companyId = await companyIdFor(slug);
  const filter: MoveFilter = partner.type === "CUSTOMER" ? { kind: "customer", id: partner.id, name: partner.name } : { kind: "supplier", id: partner.id };
  const { opening, rows } = await loadMoves(companyId, filter, dayOf(period.from), dayOf(period.to));
  return withRunningBalance(opening, rows, partner.type === "CUSTOMER" ? 1 : -1);
}

async function loadPartnerSums(companyId: string, type: "CUSTOMER" | "SUPPLIER") {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  return sumByPartner(prisma, companyId, type);
}

/**
 * Balance per customer (Customers 411, debit − credit) or per supplier (Suppliers 401,
 * credit − debit). Customers without a saved record are grouped by name.
 */
export async function getPartnerBalances(slug: CompanySlug, type: "CUSTOMER" | "SUPPLIER", supplierNames: Map<string, string> = new Map()): Promise<PartnerBalance[]> {
  const rows = await loadPartnerSums(await companyIdFor(slug), type);
  return rows
    .map((r) => {
      const debit = round2(r.debit);
      const credit = round2(r.credit);
      const name = type === "CUSTOMER" ? (r.name ?? "Unknown customer") : (supplierNames.get(r.key) ?? "Unknown supplier");
      return { key: r.key, id: r.id, name, debit, credit, balance: round2(type === "CUSTOMER" ? debit - credit : credit - debit) };
    })
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
}

async function loadVatDocuments(companyId: string, from: string | null, to: string | null) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  return vatDocuments(prisma, companyId, from, to);
}

/** Entries of a period that carry VAT, with their amount excl. VAT (for the VAT return in LBP). */
export async function getVatDocuments(slug: CompanySlug, period: Period) {
  return loadVatDocuments(await companyIdFor(slug), dayOf(period.from), dayOf(period.to));
}

async function loadJournalPage(companyId: string, f: JournalFilters) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  const q = f.q?.trim();
  const where: Prisma.JournalEntryWhereInput = {
    companyId,
    date: { gte: new Date(`${f.from}T00:00:00Z`), lte: new Date(`${f.to}T00:00:00Z`) },
    ...(f.source ? { sourceType: f.source } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { memo: { contains: q, mode: "insensitive" } },
            { lines: { some: { description: { contains: q, mode: "insensitive" } } } },
            { lines: { some: { account: { code: { startsWith: q } } } } },
          ],
        }
      : {}),
  };
  const [total, entries] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where,
      include: { lines: true, createdBy: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { number: "desc" }],
      skip: (f.page - 1) * JOURNAL_PAGE_SIZE,
      take: JOURNAL_PAGE_SIZE,
    }),
  ]);
  const reversed = await prisma.journalEntry.findMany({ where: { reversalOf: { in: entries.map((e) => e.id) } }, select: { reversalOf: true } });
  return {
    total,
    reversedIds: reversed.map((r) => r.reversalOf!),
    entries: entries.map(
      (e): LedgerEntryRow => ({
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
      }),
    ),
  };
}

/** One page of the journal (newest first), filtered by period, type and search, in SQL. */
export async function listJournal(slug: CompanySlug, filters: JournalFilters) {
  return loadJournalPage(await companyIdFor(slug), filters);
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
  const [rows, supplierPayments, receipts, payable, receivable] = await Promise.all([
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
    prisma.customerReceipt.findMany({
      where: { companyId },
      include: { invoice: { select: { id: true, number: true } }, moneyAccount: { select: { code: true, name: true } }, createdBy: { select: { name: true } } },
    }),
    prisma.ledgerAccount.findFirst({ where: { companyId, kind: "PAYABLE" }, select: { code: true, name: true } }),
    prisma.ledgerAccount.findFirst({ where: { companyId, kind: "RECEIVABLE" }, select: { code: true, name: true } }),
  ]);
  // Payments of supplier bills are payment vouchers too (PV series).
  const fromBills = supplierPayments.map((p) => ({
    id: p.id,
    number: p.number!,
    kind: "PAYMENT" as const,
    source: "SUPPLIER_PAYMENT" as const,
    purchaseId: p.purchase.id,
    invoiceId: null as string | null,
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
  // Money from customers is a receipt voucher (RV series; older ones keep their RC numbers).
  const fromCustomers = receipts.map((r) => ({
    id: r.id,
    number: r.number,
    kind: "RECEIPT" as const,
    source: "RECEIPT" as const,
    purchaseId: null as string | null,
    invoiceId: r.invoice?.id ?? null,
    date: r.receivedAt,
    moneyAccount: `${r.moneyAccount.code} ${r.moneyAccount.name}`,
    counterAccount: receivable ? `${receivable.code} ${receivable.name}` : "Customers",
    partyName: r.customerName as string | null,
    description: `${r.invoice ? `Payment of invoice ${r.invoice.number}` : "Customer payment on account"}${r.notes ? ` · ${r.notes}` : ""}`,
    amountHT: Number(r.amount),
    vatAmount: 0,
    amount: Number(r.amount),
    method: r.method,
    reference: r.reference,
    createdByName: r.createdBy.name,
    createdAt: r.createdAt,
    status: r.status as "POSTED" | "CANCELLED",
    cancelReason: r.cancelReason,
    cancelledByName: r.cancelledByName,
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
    source: "VOUCHER" as "VOUCHER" | "SUPPLIER_PAYMENT" | "RECEIPT",
    status: v.status as "POSTED" | "CANCELLED",
    cancelReason: v.cancelReason,
    cancelledByName: v.cancelledByName,
    purchaseId: null as string | null,
    invoiceId: null as string | null,
  }));
  return [...vouchers, ...fromBills, ...fromCustomers].sort((a, b) => b.date.getTime() - a.date.getTime() || b.number.localeCompare(a.number));
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
  const current = await currentLbpRate(prisma, companyId);
  return rows.map((c) => ({
    id: c.id,
    number: c.number,
    invoice: c.invoice,
    lbpRate: c.lbpRate ? Number(c.lbpRate) : current,
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
  const accounts = await getAccounts(slug);
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

async function loadLockDate(companyId: string) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { lockDate: true } });
  return company?.lockDate ? company.lockDate.toISOString().slice(0, 10) : null;
}

/** The date the books are closed up to (YYYY-MM-DD), or null when every period is open. */
export async function getLockDate(slug: CompanySlug) {
  return loadLockDate(await companyIdFor(slug));
}
