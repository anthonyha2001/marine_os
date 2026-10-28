// Financial reports computed from the ledger (pure functions, no database access).
import type { Ledger, LedgerAccountRow, LedgerEntryRow } from "@/lib/data/ledger";
import { round2 } from "@/lib/money";

export type Period = { from?: Date; to?: Date };

const inPeriod = (d: Date, p: Period) => (!p.from || d >= p.from) && (!p.to || d <= p.to);

/** Debit-side accounts (assets, expenses) grow with debits; the others with credits. */
export const debitNatured = (type: LedgerAccountRow["type"]) => type === "ASSET" || type === "EXPENSE";

export type AccountTotal = LedgerAccountRow & { debit: number; credit: number; balance: number };

/** Debit, credit and natural balance per account over a period (or up to `to`). */
export function accountTotals(ledger: Ledger, period: Period = {}): AccountTotal[] {
  const sums = new Map<string, { debit: number; credit: number }>();
  for (const e of ledger.entries) {
    if (!inPeriod(e.date, period)) continue;
    for (const l of e.lines) {
      const s = sums.get(l.accountId) ?? { debit: 0, credit: 0 };
      s.debit += l.debit;
      s.credit += l.credit;
      sums.set(l.accountId, s);
    }
  }
  return ledger.accounts.map((a) => {
    const s = sums.get(a.id) ?? { debit: 0, credit: 0 };
    const debit = round2(s.debit);
    const credit = round2(s.credit);
    return { ...a, debit, credit, balance: round2(debitNatured(a.type) ? debit - credit : credit - debit) };
  });
}

export function trialBalance(ledger: Ledger, period: Period) {
  const rows = accountTotals(ledger, period).filter((a) => a.debit !== 0 || a.credit !== 0);
  const debit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const credit = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, debit, credit, balanced: Math.abs(debit - credit) < 0.005 };
}

export function profitAndLoss(ledger: Ledger, period: Period) {
  const totals = accountTotals(ledger, period);
  const income = totals.filter((a) => a.type === "INCOME" && a.balance !== 0);
  const expenses = totals.filter((a) => a.type === "EXPENSE" && a.balance !== 0);
  const totalIncome = round2(income.reduce((s, a) => s + a.balance, 0));
  const totalExpenses = round2(expenses.reduce((s, a) => s + a.balance, 0));
  return { income, expenses, totalIncome, totalExpenses, net: round2(totalIncome - totalExpenses) };
}

/** Balance sheet at a date. The not-yet-closed result (income − expenses) is shown under equity. */
export function balanceSheet(ledger: Ledger, asOf: Date) {
  const totals = accountTotals(ledger, { to: asOf });
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

export function vatReport(ledger: Ledger, period: Period) {
  const totals = accountTotals(ledger, period);
  const collected = round2(totals.filter((a) => a.kind === "VAT_OUT").reduce((s, a) => s + a.balance, 0));
  const recoverable = round2(totals.filter((a) => a.kind === "VAT_IN").reduce((s, a) => s + a.balance, 0));
  const sales = round2(totals.filter((a) => a.kind === "SALES").reduce((s, a) => s + a.balance, 0));
  const purchases = round2(totals.filter((a) => a.kind === "PURCHASES").reduce((s, a) => s + a.balance, 0));
  return { collected, recoverable, net: round2(collected - recoverable), sales, purchases };
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

function movesFor(
  entries: LedgerEntryRow[],
  match: (l: LedgerEntryRow["lines"][number]) => boolean,
  period: Period,
  sign: 1 | -1, // +1: balance = debit − credit; −1: credit − debit
) {
  let opening = 0;
  const moves: LedgerMove[] = [];
  for (const e of entries) {
    for (const l of e.lines) {
      if (!match(l)) continue;
      const delta = sign * (l.debit - l.credit);
      if (period.from && e.date < period.from) {
        opening += delta;
        continue;
      }
      if (period.to && e.date > period.to) continue;
      moves.push({
        entryId: e.id,
        number: e.number,
        date: e.date,
        memo: e.memo,
        description: l.description,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        debit: l.debit,
        credit: l.credit,
        balance: 0,
      });
    }
  }
  let running = round2(opening);
  for (const m of moves) {
    running = round2(running + sign * (m.debit - m.credit));
    m.balance = running;
  }
  const debit = round2(moves.reduce((s, m) => s + m.debit, 0));
  const credit = round2(moves.reduce((s, m) => s + m.credit, 0));
  return { opening: round2(opening), moves, debit, credit, closing: running };
}

/** General ledger of one account, with running balance in its natural direction. */
export function accountLedger(ledger: Ledger, accountId: string, period: Period) {
  const account = ledger.accounts.find((a) => a.id === accountId);
  if (!account) return null;
  return { account, ...movesFor(ledger.entries, (l) => l.accountId === accountId, period, debitNatured(account.type) ? 1 : -1) };
}

export type Partner = { type: "CUSTOMER"; id: string | null; name: string } | { type: "SUPPLIER"; id: string; name: string };

/**
 * Statement of account. Customers: what they owe us (debit − credit on Customers 411).
 * Suppliers: what we owe them (credit − debit on Suppliers 401).
 */
export function statement(ledger: Ledger, partner: Partner, period: Period) {
  const receivable = new Set(ledger.accounts.filter((a) => a.kind === "RECEIVABLE").map((a) => a.id));
  const payable = new Set(ledger.accounts.filter((a) => a.kind === "PAYABLE").map((a) => a.id));
  if (partner.type === "CUSTOMER") {
    const name = partner.name.trim().toLowerCase();
    return movesFor(
      ledger.entries,
      (l) =>
        receivable.has(l.accountId) &&
        (partner.id ? l.customerId === partner.id || (!l.customerId && l.customerName?.trim().toLowerCase() === name) : l.customerName?.trim().toLowerCase() === name),
      period,
      1,
    );
  }
  return movesFor(ledger.entries, (l) => payable.has(l.accountId) && l.supplierId === partner.id, period, -1);
}

/** Current balance of every cash and bank account. */
export function moneyBalances(ledger: Ledger) {
  return accountTotals(ledger).filter((a) => a.kind === "CASH" || a.kind === "BANK");
}

export type PartnerBalance = { key: string; id: string | null; name: string; debit: number; credit: number; balance: number };

/**
 * Balance per customer (Customers 411, debit − credit) or per supplier (Suppliers 401,
 * credit − debit). Customers without a saved record are grouped by name.
 */
export function partnerBalances(ledger: Ledger, type: "CUSTOMER" | "SUPPLIER", supplierNames: Map<string, string> = new Map()): PartnerBalance[] {
  const kind = type === "CUSTOMER" ? "RECEIVABLE" : "PAYABLE";
  const ids = new Set(ledger.accounts.filter((a) => a.kind === kind).map((a) => a.id));
  const rows = new Map<string, PartnerBalance>();
  for (const e of ledger.entries) {
    for (const l of e.lines) {
      if (!ids.has(l.accountId)) continue;
      let key: string;
      let id: string | null;
      let name: string;
      if (type === "CUSTOMER") {
        id = l.customerId;
        name = l.customerName ?? "Unknown customer";
        key = id ?? `name:${name.trim().toLowerCase()}`;
      } else {
        if (!l.supplierId) continue;
        id = l.supplierId;
        key = id;
        name = supplierNames.get(id) ?? "Unknown supplier";
      }
      const r = rows.get(key) ?? { key, id, name, debit: 0, credit: 0, balance: 0 };
      r.debit += l.debit;
      r.credit += l.credit;
      rows.set(key, r);
    }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, debit: round2(r.debit), credit: round2(r.credit), balance: round2(type === "CUSTOMER" ? r.debit - r.credit : r.credit - r.debit) }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
}
