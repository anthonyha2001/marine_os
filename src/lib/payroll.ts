// Payroll rules shared by the browser and the server.
import { round2 } from "@/lib/money";

export const PAY_FREQUENCIES = { MONTHLY: "Monthly", WEEKLY: "Weekly" } as const;
export type PayFrequency = keyof typeof PAY_FREQUENCIES;
export const isPayFrequency = (v: string): v is PayFrequency => v in PAY_FREQUENCIES;

export const RUN_STATUS = { DRAFT: "Draft", APPROVED: "Approved", PAID: "Paid" } as const;
export type RunStatus = keyof typeof RUN_STATUS;

export type PayAmounts = { baseSalary: number; bonus: number; overtime: number; deductions: number; advance: number; nssfEmployee?: number; incomeTax?: number };

/** Salary cost: base + bonus + overtime − deductions (absence, penalties). */
export const lineGross = (l: PayAmounts) => round2(l.baseSalary + l.bonus + l.overtime - l.deductions);
/** Paid out: the salary minus NSSF and income tax withheld, minus the advance being paid back. */
export const lineNet = (l: PayAmounts) => round2(lineGross(l) - (l.nssfEmployee ?? 0) - (l.incomeTax ?? 0) - l.advance);

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

// ── NSSF and income tax ──

export type TaxBracket = { upTo: number | null; rate: number }; // annual USD; null = and above
export type PayrollRules = {
  sicknessEmployee: number;
  sicknessEmployer: number;
  sicknessCap: number; // monthly USD, 0 = none
  familyEmployer: number;
  familyCap: number;
  endOfService: number;
  brackets: TaxBracket[];
  defaultExemption: number;
};
export const NO_RULES: PayrollRules = { sicknessEmployee: 0, sicknessEmployer: 0, sicknessCap: 0, familyEmployer: 0, familyCap: 0, endOfService: 0, brackets: [], defaultExemption: 0 };

/** "18000 2" lines → brackets; "* 25" (or a line without a limit) is the top rate. */
export function parseBrackets(text: string): TaxBracket[] {
  return text
    .split("\n")
    .map((l) => l.trim().replace(/,/g, "").split(/\s+/))
    .filter((p) => p.length >= 1 && p[0] !== "")
    .map((p) => (p.length === 1 || p[0] === "*" ? { upTo: null, rate: Number(p[p.length - 1].replace("%", "")) || 0 } : { upTo: Number(p[0]) || 0, rate: Number(p[1].replace("%", "")) || 0 }))
    .sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
}

/** Progressive tax on a yearly taxable amount. */
export function progressiveTax(yearly: number, brackets: TaxBracket[]) {
  let tax = 0;
  let floor = 0;
  for (const b of brackets) {
    const top = b.upTo ?? Infinity;
    if (yearly > floor) tax += (Math.min(yearly, top) - floor) * (b.rate / 100);
    floor = top;
    if (yearly <= floor) break;
  }
  return tax;
}

/**
 * NSSF and income tax for one pay line. Ceilings are monthly (scaled for weekly pay); income
 * tax is worked out on the yearly equivalent (after the employee's NSSF and their yearly
 * exemption) and spread back over the pay periods.
 */
export function statutory(gross: number, frequency: PayFrequency, rules: PayrollRules, employee: { nssfEnrolled: boolean; taxExemption: number }) {
  const periods = frequency === "WEEKLY" ? 52 : 12;
  const scale = 12 / periods;
  const base = Math.max(0, gross);
  const cap = (c: number) => (c > 0 ? Math.min(base, c * scale) : base);
  const nssfEmployee = employee.nssfEnrolled ? round2((cap(rules.sicknessCap) * rules.sicknessEmployee) / 100) : 0;
  const nssfEmployer = employee.nssfEnrolled
    ? round2((cap(rules.sicknessCap) * rules.sicknessEmployer + cap(rules.familyCap) * rules.familyEmployer + base * rules.endOfService) / 100)
    : 0;
  const yearlyTaxable = Math.max(0, (base - nssfEmployee) * periods - employee.taxExemption);
  const incomeTax = rules.brackets.length ? round2(progressiveTax(yearlyTaxable, rules.brackets) / periods) : 0;
  return { nssfEmployee, nssfEmployer, incomeTax };
}
