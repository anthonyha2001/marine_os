// Accounting constants and helpers shared by server and client code.
import { round2 } from "@/lib/money";

export const PAYMENT_METHODS = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
  CARD: "Card",
  OTHER: "Other",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export function isPaymentMethod(value: string): value is PaymentMethod {
  return value in PAYMENT_METHODS;
}

export type BillStatus = "PAID" | "PARTLY_PAID" | "UNPAID" | "OVERDUE";

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  PAID: "Paid",
  PARTLY_PAID: "Partly paid",
  UNPAID: "Unpaid",
  OVERDUE: "Overdue",
};

/** Status of a supplier bill from its total, what was paid and its due date. */
export function billStatus(total: number, paid: number, dueDate: Date, today = new Date()): BillStatus {
  const balance = round2(total - paid);
  if (balance <= 0) return "PAID";
  if (dueDate.toISOString().slice(0, 10) < today.toISOString().slice(0, 10)) return "OVERDUE";
  return paid > 0 ? "PARTLY_PAID" : "UNPAID";
}
