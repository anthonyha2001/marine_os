// Offer calculations and constants, shared by the editor, the server and the PDF.
import { VAT_RATE, round2 } from "@/lib/money";

export const OFFER_STATUSES = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
} as const;
export type OfferStatus = keyof typeof OFFER_STATUSES;

export function isOfferStatus(value: string): value is OfferStatus {
  return value in OFFER_STATUSES;
}

/** Suggested protective markings, printed at the top and bottom of every page. */
export const MARKING_SUGGESTIONS = [
  "COMMERCIAL IN CONFIDENCE",
  "CONFIDENTIAL",
  "RESTRICTED",
  "FOR OFFICIAL USE ONLY",
];

export const DEFAULT_INTRO =
  "Dear Sir / Madam,\n\nFurther to your request, we are pleased to submit our offer for the supply of the services and items detailed below.";

export const DEFAULT_TERMS = [
  "Prices are in US Dollars (USD).",
  "Delivery / execution: to be confirmed upon receipt of the purchase order.",
  "Warranty: 6 months on workmanship and parts supplied, excluding misuse and normal wear.",
  "This offer is valid until the date stated above.",
].join("\n");

export type DiscountType = "PERCENT" | "AMOUNT";

export type OfferLineInput = {
  kind: "ITEM" | "SECTION";
  quantity: number;
  unitPrice: number;
  discountPercent: number;
};

export function lineTotal(line: Pick<OfferLineInput, "quantity" | "unitPrice" | "discountPercent">) {
  const discount = Math.min(Math.max(line.discountPercent, 0), 100);
  return round2(line.quantity * line.unitPrice * (1 - discount / 100));
}

/** Display numbers for item rows (sections get null): [1, null, 2, 3, …]. */
export function itemNumbers(lines: { kind: "ITEM" | "SECTION" }[]) {
  let count = 0;
  return lines.map((l) => (l.kind === "ITEM" ? ++count : null));
}

export type OfferTotals = {
  subtotal: number;
  discountTotal: number;
  totalHT: number;
  vatAmount: number;
  totalTTC: number;
};

export function offerTotals(
  lines: OfferLineInput[],
  discountType: DiscountType,
  discountValue: number,
  applyVat: boolean,
): OfferTotals {
  const subtotal = round2(lines.filter((l) => l.kind === "ITEM").reduce((sum, l) => sum + lineTotal(l), 0));
  const value = Math.max(discountValue, 0);
  const discountTotal = round2(
    discountType === "PERCENT" ? subtotal * (Math.min(value, 100) / 100) : Math.min(value, subtotal),
  );
  const totalHT = round2(subtotal - discountTotal);
  const vatAmount = applyVat ? round2(totalHT * VAT_RATE) : 0;
  return { subtotal, discountTotal, totalHT, vatAmount, totalTTC: round2(totalHT + vatAmount) };
}

// ── Amount in words (English), e.g. for "Say: US Dollars … only" ──

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion"];

function underThousand(n: number) {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

export function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const groups: string[] = [];
  let scale = 0;
  while (n > 0 && scale < SCALES.length) {
    const chunk = n % 1000;
    if (chunk) groups.unshift(`${underThousand(chunk)}${SCALES[scale] ? ` ${SCALES[scale]}` : ""}`);
    n = Math.floor(n / 1000);
    scale++;
  }
  return groups.join(" ");
}

/** 1234.5 → "US Dollars One Thousand Two Hundred Thirty-Four and 50/100 only" */
export function amountInWords(amount: number) {
  const cents = Math.round(amount * 100);
  const dollars = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return `US Dollars ${integerToWords(dollars)} and ${rest}/100 only`;
}

// ── Payment schedule ──
// Three plans: one full payment, custom percentages (e.g. 60 / 40), or N equal payments.
// Amounts include VAT: they are what the customer pays on each invoice.

export const PAYMENT_PLANS = {
  FULL: "Full payment",
  PERCENT: "Percentages",
  INSTALLMENTS: "Divided into payments",
} as const;
export type PaymentPlan = keyof typeof PAYMENT_PLANS;

export function isPaymentPlan(value: string): value is PaymentPlan {
  return value in PAYMENT_PLANS;
}

// BALANCE = "whatever is left" (used for the last equal payment so cents add up).
export type PaymentMode = "PERCENT" | "BALANCE";

export type PaymentTermInput = { label: string; mode: PaymentMode; value: number; dueDays: number };

export type ScheduledPayment = PaymentTermInput & { amount: number; percent: number };

/** Quick splits offered under "Percentages". */
export const PERCENT_PRESETS = [
  [50, 50],
  [60, 40],
  [30, 40, 30],
];

export function fullTerms(): PaymentTermInput[] {
  return [{ label: "Full payment", mode: "PERCENT", value: 100, dueDays: 0 }];
}

export function percentTerms(split: number[]): PaymentTermInput[] {
  return split.map((p, i) => ({
    label: i === 0 ? "Advance payment" : i === split.length - 1 ? "Final payment" : `Payment ${i + 1}`,
    mode: "PERCENT",
    value: p,
    dueDays: 0,
  }));
}

export const MAX_INSTALLMENTS = 24;

export function equalTerms(count: number): PaymentTermInput[] {
  const n = Math.max(1, Math.min(Math.floor(count) || 1, MAX_INSTALLMENTS));
  return Array.from({ length: n }, (_, i) => ({
    label: n === 1 ? "Full payment" : `Payment ${i + 1} of ${n}`,
    mode: n > 1 && i === n - 1 ? "BALANCE" : "PERCENT",
    value: Math.round((100 / n) * 10000) / 10000,
    dueDays: 0,
  }));
}

/**
 * The schedule rows for a plan. FULL and INSTALLMENTS are always rebuilt from the plan
 * (so they can't be wrong); descriptions and due days typed by the user are kept.
 */
export function termsForPlan(plan: PaymentPlan, rows: PaymentTermInput[], installments: number): PaymentTermInput[] {
  const base = plan === "FULL" ? fullTerms() : plan === "INSTALLMENTS" ? equalTerms(installments) : rows;
  if (plan === "PERCENT") return rows.map((r) => ({ ...r, mode: "PERCENT" }));
  return base.map((t, i) => ({ ...t, label: rows[i]?.label?.trim() || t.label, dueDays: rows[i]?.dueDays ?? t.dueDays }));
}

/** Work out each row's amount and share of `total`, plus what's left unscheduled. */
export function schedulePayments(terms: PaymentTermInput[], total: number) {
  const amounts = terms.map((t) => (t.mode === "PERCENT" ? round2((total * t.value) / 100) : 0));
  const balanceIndex = terms.findIndex((t) => t.mode === "BALANCE");
  if (balanceIndex >= 0) {
    amounts[balanceIndex] = round2(total - amounts.reduce((s, a, i) => (i === balanceIndex ? s : s + a), 0));
  } else if (terms.length && Math.abs(terms.reduce((s, t) => s + t.value, 0) - 100) < 0.0001) {
    // Percentages adding to 100 must add to the exact total: the last row absorbs rounding.
    amounts[amounts.length - 1] = round2(total - amounts.slice(0, -1).reduce((s, a) => s + a, 0));
  }
  const payments: ScheduledPayment[] = terms.map((t, i) => ({
    ...t,
    amount: amounts[i],
    percent: total > 0 ? Math.round((amounts[i] / total) * 1000000) / 10000 : 0,
  }));
  const percentTotal = Math.round(terms.reduce((s, t) => s + (t.mode === "BALANCE" ? 0 : t.value), 0) * 10000) / 10000;
  return { payments, percentTotal };
}

/** Problems that block saving a schedule, or null if it's valid. */
export function scheduleProblem(plan: PaymentPlan, terms: PaymentTermInput[]): string | null {
  if (terms.length === 0) return "Add at least one payment";
  if (terms.some((t) => !t.label.trim())) return "Every payment needs a description";
  if (plan !== "PERCENT") return null;
  if (terms.some((t) => !(t.value > 0))) return "Every percentage must be more than 0";
  const sum = Math.round(terms.reduce((s, t) => s + t.value, 0) * 10000) / 10000;
  if (Math.abs(sum - 100) >= 0.0001) return `The percentages add up to ${sum}%, not 100%`;
  return null;
}

/**
 * Excl.-VAT / VAT parts of one invoice against an offer, given what is already invoiced
 * (non-cancelled). Parts are proportional to the offer; the invoice that completes the offer
 * takes the rounding, so all invoices together match the offer totals exactly.
 */
export function invoiceVatSplit(
  amountTTC: number,
  offer: { totalHT: number; totalTTC: number },
  invoiced: { totalHT: number; totalTTC: number },
) {
  const completes = Math.abs(invoiced.totalTTC + amountTTC - offer.totalTTC) < 0.005;
  const totalHT = completes
    ? round2(offer.totalHT - invoiced.totalHT)
    : offer.totalTTC > 0
      ? round2((amountTTC * offer.totalHT) / offer.totalTTC)
      : amountTTC;
  return { totalTTC: round2(amountTTC), totalHT, vatAmount: round2(amountTTC - totalHT) };
}

/**
 * What each scheduled payment will actually be invoiced at: its scheduled amount, capped
 * by what is still left on the offer (custom invoices reduce the later payments).
 */
export function projectedPayments(
  terms: { id: string; amount: number; invoiced: boolean }[],
  offerTotalTTC: number,
  invoicedTTC: number,
) {
  let left = round2(offerTotalTTC - invoicedTTC);
  return new Map(
    terms.map((t) => {
      if (t.invoiced) return [t.id, t.amount];
      const amount = Math.max(0, Math.min(t.amount, left));
      left = round2(left - amount);
      return [t.id, round2(amount)];
    }),
  );
}

export const INVOICE_STATUSES = { ISSUED: "Unpaid", PAID: "Paid", CANCELLED: "Cancelled" } as const;
export type InvoiceStatus = keyof typeof INVOICE_STATUSES;

export function dueLabel(days: number) {
  return days > 0 ? `${days} days after invoice` : "On invoice";
}
