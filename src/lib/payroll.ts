// Payroll rules shared by the browser and the server.
import { round2 } from "@/lib/money";

export const PAY_FREQUENCIES = { MONTHLY: "Monthly", WEEKLY: "Weekly" } as const;
export type PayFrequency = keyof typeof PAY_FREQUENCIES;
export const isPayFrequency = (v: string): v is PayFrequency => v in PAY_FREQUENCIES;

export const RUN_STATUS = { DRAFT: "Draft", APPROVED: "Approved", PAID: "Paid" } as const;
export type RunStatus = keyof typeof RUN_STATUS;

export type PayAmounts = { baseSalary: number; bonus: number; overtime: number; deductions: number; advance: number };

/** Salary cost: base + bonus + overtime − deductions (absence, penalties). */
export const lineGross = (l: PayAmounts) => round2(l.baseSalary + l.bonus + l.overtime - l.deductions);
/** Paid out: the salary cost minus the advance being paid back. */
export const lineNet = (l: PayAmounts) => round2(lineGross(l) - l.advance);

const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The pay period for a frequency. Monthly: "YYYY-MM" (or any day in it) → the whole month.
 * Weekly: any date → that week, Monday to Sunday.
 */
export function payPeriod(frequency: PayFrequency, value: string) {
  if (frequency === "MONTHLY") {
    const m = /^(\d{4})-(\d{2})/.exec(value);
    if (!m) return null;
    const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
    const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0));
    return { start, end, label: monthLabel.format(start) };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  const start = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return { start, end, label: `Week of ${dayLabel.format(start)}` };
}

/** A weekly salary expressed per month (52 weeks / 12 months), for totals. */
export const monthlyEquivalent = (frequency: PayFrequency, amount: number) => (frequency === "WEEKLY" ? round2((amount * 52) / 12) : amount);
