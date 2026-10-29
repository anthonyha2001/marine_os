// Point of sale rules shared by the till (browser) and the server, so both compute the same totals.
import { VAT_RATE, round2 } from "@/lib/money";
import type { CompanySlug, Role } from "@/lib/permissions";

/** Companies with a retail counter. */
export const POS_COMPANIES: CompanySlug[] = ["eliche-radice"];
export const hasPos = (slug: CompanySlug) => POS_COMPANIES.includes(slug);

/** What the till allows (POS settings page). Cashier limits only bind the CASHIER role. */
export type PosRules = {
  maxDiscountPct: number;
  allowUsd: boolean;
  allowLbp: boolean;
  allowCard: boolean;
  cardOverpay: "BLOCK" | "CHANGE";
  sellOutOfStock: boolean;
  customerRequiredAbove: number;
  cashierRefunds: boolean;
  refundDays: number;
  blindClose: boolean;
  cashierSeesShiftTotals: boolean;
  receiptNote: string | null;
};

export const DEFAULT_POS_RULES: PosRules = {
  maxDiscountPct: 10,
  allowUsd: true,
  allowLbp: true,
  allowCard: true,
  cardOverpay: "BLOCK",
  sellOutOfStock: true,
  customerRequiredAbove: 0,
  cashierRefunds: true,
  refundDays: 0,
  blindClose: false,
  cashierSeesShiftTotals: true,
  receiptNote: null,
};

/** The rules as they apply to this person: managers, accountants and admins aren't limited. */
export function rulesFor(rules: PosRules, role: Role): PosRules {
  if (role !== "CASHIER") return { ...rules, maxDiscountPct: 100, sellOutOfStock: true, cashierRefunds: true, refundDays: 0, blindClose: false, cashierSeesShiftTotals: true };
  return rules;
}

/** Who may change prices and till settings. */
export const canManagePos = (role: Role) => role === "ADMIN" || role === "MANAGER";

/** Shop price incl. VAT → price excl. VAT, kept to 4 decimals so it adds back up to exactly that shelf price. */
export const htForShelfPrice = (ttc: number) => Math.round((ttc / (1 + VAT_RATE)) * 10000) / 10000;

/** Price incl. VAT the customer sees for one unit. */
export const shelfPrice = (unitPriceHT: number) => round2(unitPriceHT * (1 + VAT_RATE));

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

/**
 * Sale totals in USD. Shop prices include VAT, so the total is worked out from the shelf prices
 * (3 × $14.00 = $42.00 exactly), then split into the price excl. VAT and the 11% VAT inside it.
 */
export function saleTotals(lines: CartLine[], discountPct: number) {
  const subtotalTTC = round2(lines.reduce((s, l) => s + round2(shelfPrice(l.unitPriceHT) * l.quantity), 0));
  const totalTTC = round2((subtotalTTC * (100 - Math.min(Math.max(discountPct, 0), 100))) / 100);
  const subtotalHT = round2(subtotalTTC / (1 + VAT_RATE));
  const totalHT = round2(totalTTC / (1 + VAT_RATE));
  return { subtotalHT, discountHT: round2(subtotalHT - totalHT), totalHT, vatAmount: round2(totalTTC - totalHT), totalTTC };
}

/** Amount incl. VAT given back for returned units (the sale's discount applies). */
export const refundTTC = (unitPriceHT: number, quantity: number, discountPct: number) => round2((shelfPrice(unitPriceHT) * quantity * (100 - discountPct)) / 100);

export type ChangeCurrency = "USD" | "LBP";

/**
 * Settle a payment: what was handed over (USD notes, LBP notes, card) against the total.
 * Card can't exceed the total and never gives change; change comes back in one currency.
 */
export function settle(input: { totalTTC: number; rate: number; paidUsd: number; paidLbp: number; paidCard: number; changeCurrency: ChangeCurrency; cardOverpay?: "BLOCK" | "CHANGE" }) {
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
  // Card can't exceed the total unless the settings allow giving the extra back in cash.
  const cardTooHigh = input.cardOverpay !== "CHANGE" && paidCard > totalTTC + 0.004;
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
