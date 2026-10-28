import "server-only";
import { prisma, type Tx } from "@/lib/prisma";

// Default chart of accounts (Lebanese numbering, simplified for a marine services company).
// "System" accounts are used by automatic postings and can't be deleted.

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
export type AccountKind =
  | "CASH"
  | "BANK"
  | "RECEIVABLE"
  | "PAYABLE"
  | "VAT_IN"
  | "VAT_OUT"
  | "SALES"
  | "PURCHASES"
  | "EXPENSE"
  | "INCOME"
  | "CAPITAL"
  | "OTHER";

type Seed = { code: string; name: string; type: AccountType; kind: AccountKind; system?: boolean };

export const DEFAULT_CHART: Seed[] = [
  // Equity
  { code: "101", name: "Share capital", type: "EQUITY", kind: "CAPITAL", system: true },
  { code: "120", name: "Retained earnings", type: "EQUITY", kind: "OTHER", system: true },
  // Liabilities
  { code: "164", name: "Bank loans", type: "LIABILITY", kind: "OTHER" },
  { code: "401", name: "Suppliers", type: "LIABILITY", kind: "PAYABLE", system: true },
  { code: "421", name: "Salaries payable", type: "LIABILITY", kind: "OTHER" },
  // Money advanced to staff, paid back through payroll.
  { code: "425", name: "Staff advances", type: "ASSET", kind: "OTHER", system: true },
  { code: "4427", name: "VAT collected", type: "LIABILITY", kind: "VAT_OUT", system: true },
  { code: "455", name: "Partners' current accounts", type: "LIABILITY", kind: "OTHER" },
  // Goods sent to / received from the sister company (debit: they owe us; credit: we owe them).
  { code: "458", name: "Sister company account", type: "ASSET", kind: "OTHER", system: true },
  // Assets
  { code: "411", name: "Customers", type: "ASSET", kind: "RECEIVABLE", system: true },
  { code: "4426", name: "VAT recoverable", type: "ASSET", kind: "VAT_IN", system: true },
  { code: "512", name: "Bank", type: "ASSET", kind: "BANK", system: true },
  { code: "530", name: "Cash", type: "ASSET", kind: "CASH", system: true },
  // LBP notes in the till, kept at their USD value on the day they were taken.
  { code: "531", name: "Cash LBP", type: "ASSET", kind: "CASH", system: true },
  // Income
  { code: "701", name: "Sales of goods and services", type: "INCOME", kind: "SALES", system: true },
  { code: "758", name: "Other income", type: "INCOME", kind: "INCOME" },
  // Expenses
  { code: "601", name: "Purchases of goods", type: "EXPENSE", kind: "PURCHASES", system: true },
  { code: "6061", name: "Electricity and water", type: "EXPENSE", kind: "EXPENSE" },
  { code: "6062", name: "Fuel", type: "EXPENSE", kind: "EXPENSE" },
  { code: "611", name: "Subcontracting", type: "EXPENSE", kind: "EXPENSE" },
  { code: "613", name: "Rent", type: "EXPENSE", kind: "EXPENSE" },
  { code: "615", name: "Maintenance and repairs", type: "EXPENSE", kind: "EXPENSE" },
  { code: "616", name: "Insurance", type: "EXPENSE", kind: "EXPENSE" },
  { code: "618", name: "Office supplies", type: "EXPENSE", kind: "EXPENSE" },
  { code: "623", name: "Advertising and marketing", type: "EXPENSE", kind: "EXPENSE" },
  { code: "624", name: "Transport and freight", type: "EXPENSE", kind: "EXPENSE" },
  { code: "625", name: "Travel", type: "EXPENSE", kind: "EXPENSE" },
  { code: "626", name: "Telephone and internet", type: "EXPENSE", kind: "EXPENSE" },
  { code: "627", name: "Bank charges", type: "EXPENSE", kind: "EXPENSE" },
  { code: "635", name: "Taxes and fees", type: "EXPENSE", kind: "EXPENSE" },
  { code: "641", name: "Salaries and wages", type: "EXPENSE", kind: "EXPENSE", system: true },
  { code: "645", name: "Social security (NSSF)", type: "EXPENSE", kind: "EXPENSE" },
  { code: "658", name: "Other expenses", type: "EXPENSE", kind: "EXPENSE" },
];

/** Create any missing default accounts for a company (safe to run repeatedly). */
export async function ensureChart(companyId: string, db: Tx | typeof prisma = prisma) {
  const existing = new Set((await db.ledgerAccount.findMany({ where: { companyId }, select: { code: true } })).map((a) => a.code));
  const missing = DEFAULT_CHART.filter((a) => !existing.has(a.code));
  if (missing.length) {
    await db.ledgerAccount.createMany({
      data: missing.map((a) => ({ companyId, code: a.code, name: a.name, type: a.type, kind: a.kind, isSystem: !!a.system })),
      skipDuplicates: true,
    });
  }
  // Accounts that became system accounts later (e.g. 641 when payroll was added) get locked too.
  await db.ledgerAccount.updateMany({
    where: { companyId, isSystem: false, code: { in: DEFAULT_CHART.filter((a) => a.system).map((a) => a.code) } },
    data: { isSystem: true },
  });
}

export type SystemAccounts = Record<"CASH" | "CASH_LBP" | "BANK" | "RECEIVABLE" | "PAYABLE" | "INTERCOMPANY" | "SALARIES" | "STAFF_ADVANCES" | "VAT_IN" | "VAT_OUT" | "SALES" | "PURCHASES", string>;

const SYSTEM_CODES: Record<keyof SystemAccounts, string> = {
  CASH: "530",
  CASH_LBP: "531",
  BANK: "512",
  RECEIVABLE: "411",
  PAYABLE: "401",
  INTERCOMPANY: "458",
  SALARIES: "641",
  STAFF_ADVANCES: "425",
  VAT_IN: "4426",
  VAT_OUT: "4427",
  SALES: "701",
  PURCHASES: "601",
};

/** Ids of the accounts automatic postings use (creating the chart first if needed). */
export async function systemAccounts(companyId: string, db: Tx | typeof prisma = prisma): Promise<SystemAccounts> {
  let accounts = await db.ledgerAccount.findMany({
    where: { companyId, code: { in: Object.values(SYSTEM_CODES) } },
    select: { id: true, code: true },
  });
  if (accounts.length < Object.keys(SYSTEM_CODES).length) {
    await ensureChart(companyId, db);
    accounts = await db.ledgerAccount.findMany({
      where: { companyId, code: { in: Object.values(SYSTEM_CODES) } },
      select: { id: true, code: true },
    });
  }
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  return Object.fromEntries(Object.entries(SYSTEM_CODES).map(([k, code]) => [k, byCode.get(code)!])) as SystemAccounts;
}
