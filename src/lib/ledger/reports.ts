// Financial reports from account totals summed in SQL (src/lib/data/ledger.ts). Pure functions,
// no database access.
import type { LedgerAccountRow } from "@/lib/data/ledger";
import { round2 } from "@/lib/money";

export type Period = { from?: Date; to?: Date };

/** Debit-side accounts (assets, expenses) grow with debits; the others with credits. */
export const debitNatured = (type: LedgerAccountRow["type"]) => type === "ASSET" || type === "EXPENSE";

export type AccountTotal = LedgerAccountRow & { debit: number; credit: number; balance: number };

/** Debit, credit and natural balance per account, from the SQL sums (accounts without moves get 0). */
export function accountTotalsFrom(accounts: LedgerAccountRow[], sums: { accountId: string; debit: number; credit: number }[]): AccountTotal[] {
  const byId = new Map(sums.map((s) => [s.accountId, s]));
  return accounts.map((a) => {
    const s = byId.get(a.id);
    const debit = round2(s?.debit ?? 0);
    const credit = round2(s?.credit ?? 0);
    return { ...a, debit, credit, balance: round2(debitNatured(a.type) ? debit - credit : credit - debit) };
  });
}

export function trialBalance(totals: AccountTotal[]) {
  const rows = totals.filter((a) => a.debit !== 0 || a.credit !== 0);
  const debit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const credit = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, debit, credit, balanced: Math.abs(debit - credit) < 0.005 };
}

export function profitAndLoss(totals: AccountTotal[]) {
  const income = totals.filter((a) => a.type === "INCOME" && a.balance !== 0);
  const expenses = totals.filter((a) => a.type === "EXPENSE" && a.balance !== 0);
  const totalIncome = round2(income.reduce((s, a) => s + a.balance, 0));
  const totalExpenses = round2(expenses.reduce((s, a) => s + a.balance, 0));
  return { income, expenses, totalIncome, totalExpenses, net: round2(totalIncome - totalExpenses) };
}

/** Balance sheet from the totals up to a date. The not-yet-closed result (income − expenses) is shown under equity. */
export function balanceSheet(totals: AccountTotal[]) {
  const pick = (type: LedgerAccountRow["type"]) => totals.filter((a) => a.type === type && a.balance !== 0);
  const assets = pick("ASSET");
  const liabilities = pick("LIABILITY");
  const equity = pick("EQUITY");
  const result = round2(
    totals.filter((a) => a.type === "INCOME").reduce((s, a) => s + a.balance, 0) -
      totals.filter((a) => a.type === "EXPENSE").reduce((s, a) => s + a.balance, 0),
  );
  const totalAssets = round2(assets.reduce((s, a) => s + a.balance, 0));
  const totalLiabilities = round2(liabilities.reduce((s, a) => s + a.balance, 0));
  const totalEquity = round2(equity.reduce((s, a) => s + a.balance, 0) + result);
  return {
    assets,
    liabilities,
    equity,
    result,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.005,
  };
}

export function vatReport(totals: AccountTotal[]) {
  const sum = (kind: string) => round2(totals.filter((a) => a.kind === kind).reduce((s, a) => s + a.balance, 0));
  const collected = sum("VAT_OUT");
  const recoverable = sum("VAT_IN");
  return { collected, recoverable, net: round2(collected - recoverable), sales: sum("SALES"), purchases: sum("PURCHASES") };
}

/** Current balance of every cash and bank account. */
export function moneyBalances(totals: AccountTotal[]) {
  return totals.filter((a) => a.kind === "CASH" || a.kind === "BANK");
}

export type LedgerMove = {
  entryId: string;
  number: string;
  date: Date;
  memo: string;
  description: string | null;
  sourceType: string;
  sourceId: string | null;
  debit: number;
  credit: number;
  balance: number;
};

/**
 * Running balance over moves read in date order, from the opening balance (both as debit − credit).
 * sign +1: balance = debit − credit; −1: credit − debit.
 */
export function withRunningBalance(openingDebitMinusCredit: number, rows: Omit<LedgerMove, "balance">[], sign: 1 | -1) {
  const opening = round2(sign * openingDebitMinusCredit);
  let running = opening;
  const moves: LedgerMove[] = rows.map((m) => {
    running = round2(running + sign * (m.debit - m.credit));
    return { ...m, balance: running };
  });
  const debit = round2(moves.reduce((s, m) => s + m.debit, 0));
  const credit = round2(moves.reduce((s, m) => s + m.credit, 0));
  return { opening, moves, debit, credit, closing: running };
}

export type Partner = { type: "CUSTOMER"; id: string | null; name: string } | { type: "SUPPLIER"; id: string; name: string };

export type PartnerBalance = { key: string; id: string | null; name: string; debit: number; credit: number; balance: number };
