// Point of sale rules shared by the till (browser) and the server, so both compute the same totals.
import { VAT_RATE, round2 } from "@/lib/money";
import type { CompanySlug, Role } from "@/lib/permissions";

/** Companies with a retail counter. */
export const POS_COMPANIES: CompanySlug[] = ["eliche-radice"];
export const hasPos = (slug: CompanySlug) => POS_COMPANIES.includes(slug);

/** Largest discount a cashier may give on a sale (%). Managers and admins: any. */
export const MAX_CASHIER_DISCOUNT = 10;
export const maxDiscountFor = (role: Role) => (role === "CASHIER" ? MAX_CASHIER_DISCOUNT : 100);

/** Roles that may set the exchange rate. */
export const canSetRate = (role: Role) => role === "ADMIN" || role === "MANAGER" || role === "ACCOUNTANT";

/** LBP amounts are handled in steps of 1,000 (smaller notes aren't in use). */
export const LBP_STEP = 1000;
export const roundLbp = (value: number) => Math.round(value / LBP_STEP) * LBP_STEP;
export const ceilLbp = (value: number) => Math.ceil(value / LBP_STEP - 1e-9) * LBP_STEP;

const lbpFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const formatLbp = (value: number) => `LBP ${lbpFormat.format(value)}`;
export const formatRate = (value: number) => `${lbpFormat.format(value)} LBP / $`;

export type CartLine = { unitPriceHT: number; quantity: number };

/** Sale totals in USD: lines, then the sale discount, then 11% VAT. */
export function saleTotals(lines: CartLine[], discountPct: number) {
  const subtotalHT = round2(lines.reduce((s, l) => s + round2(l.unitPriceHT * l.quantity), 0));
  const discountHT = round2((subtotalHT * Math.min(Math.max(discountPct, 0), 100)) / 100);
  const totalHT = round2(subtotalHT - discountHT);
  const vatAmount = round2(totalHT * VAT_RATE);
  return { subtotalHT, discountHT, totalHT, vatAmount, totalTTC: round2(totalHT + vatAmount) };
}

export type ChangeCurrency = "USD" | "LBP";

/**
 * Settle a payment: what was handed over (USD notes, LBP notes, card) against the total.
 * Card can't exceed the total and never gives change; change comes back in one currency.
 */
export function settle(input: { totalTTC: number; rate: number; paidUsd: number; paidLbp: number; paidCard: number; changeCurrency: ChangeCurrency }) {
  const { totalTTC, rate } = input;
  const paidUsd = round2(Math.max(0, input.paidUsd));
  const paidLbp = Math.max(0, Math.round(input.paidLbp));
  const paidCard = round2(Math.max(0, input.paidCard));
  // Exact (unrounded) USD value handed over; rounding happens once, in the change currency.
  const exactTendered = paidUsd + paidCard + (rate > 0 ? paidLbp / rate : 0);
  const tendered = round2(exactTendered);
  const remaining = round2(totalTTC - exactTendered);
  const over = Math.max(0, exactTendered - totalTTC);
  let changeUsd = 0;
  let changeLbp = 0;
  if (over > 0.004) {
    if (input.changeCurrency === "LBP") changeLbp = roundLbp(paidLbp + (paidUsd + paidCard - totalTTC) * rate);
    else changeUsd = round2(over);
  }
  // Card can't exceed the total, so any change comes out of the cash handed over.
  const cardTooHigh = paidCard > totalTTC + 0.004;
  return {
    paidUsd,
    paidLbp,
    paidCard,
    tendered,
    remaining: Math.max(0, remaining),
    remainingLbp: remaining > 0 ? ceilLbp(remaining * rate) : 0,
    changeUsd,
    changeLbp,
    ok: remaining <= 0.004 && !cardTooHigh,
    cardTooHigh,
  };
}

/** USD value of the LBP kept in the till for a sale: whatever the USD and card part don't cover. */
export function lbpUsdValue(totalTTC: number, paidUsd: number, changeUsd: number, paidCard: number) {
  return round2(totalTTC - (paidUsd - changeUsd) - paidCard);
}

export const REFUND_METHODS = { CASH_USD: "Cash USD", CASH_LBP: "Cash LBP", CARD: "Card" } as const;
export type RefundMethod = keyof typeof REFUND_METHODS;
export const isRefundMethod = (v: string): v is RefundMethod => v in REFUND_METHODS;

export const SALE_STATUS = { COMPLETED: "Completed", PARTLY_REFUNDED: "Partly refunded", REFUNDED: "Refunded" } as const;

/** Difference between counted and expected cash, valued in USD at the closing rate. */
export function shiftDifference(s: { expectedUsd: number | null; expectedLbp: number | null; countedUsd: number | null; countedLbp: number | null; closeRate: number | null }) {
  if (s.countedUsd === null || s.expectedUsd === null || s.countedLbp === null || s.expectedLbp === null || !s.closeRate) return null;
  return round2(s.countedUsd - s.expectedUsd + (s.countedLbp - s.expectedLbp) / s.closeRate);
}
