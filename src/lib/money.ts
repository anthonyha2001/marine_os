// VAT and money helpers shared by server and client code.

export const VAT_RATE = 0.11; // Lebanon VAT, 11%
export const CURRENCY = "USD";

/** Round to cents, avoiding floating-point drift (e.g. 1.005 → 1.01). */
export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function withVat(priceHT: number) {
  return round2(priceHT * (1 + VAT_RATE));
}

export type PurchaseTotals = {
  subtotalHT: number;
  discount: number;
  totalHT: number;
  vatAmount: number;
  totalTTC: number;
};

/** Purchase totals: VAT is charged on the amount after discount. */
export function purchaseTotals(
  lines: { quantity: number; unitPriceHT: number }[],
  discount: number,
): PurchaseTotals {
  const subtotalHT = round2(lines.reduce((sum, l) => sum + l.quantity * l.unitPriceHT, 0));
  const totalHT = round2(Math.max(0, subtotalHT - discount));
  const vatAmount = round2(totalHT * VAT_RATE);
  return { subtotalHT, discount: round2(discount), totalHT, vatAmount, totalTTC: round2(totalHT + vatAmount) };
}

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY });

export function formatMoney(value: number | string | { toString(): string }) {
  return formatter.format(Number(value.toString()));
}
