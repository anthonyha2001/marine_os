"use server";

import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toRecycleBin } from "@/lib/recycle-bin";
import { deleteRefusal } from "@/lib/delete-rules";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import { getPayrollRules, payrollTag } from "@/lib/data/payroll";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { nextNumber } from "@/lib/ledger/numbering";
import { postPayroll, removeEntries } from "@/lib/ledger/posting";
import { round2 } from "@/lib/money";
import { isPayFrequency, lineGross, lineNet, payPeriod, statutory, type PayFrequency, type PayrollRules } from "@/lib/payroll";

export type PayrollFormState = { error?: string };

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

async function ctx(companySlug: string) {
  const c = await requireModule(companySlug, "payroll");
  return { ...c, companyId: await companyIdFor(c.slug) };
}

// ── Staff ──

const employeeSchema = z.object({
  name: z.string().trim().min(2, "Enter the employee's name").max(120),
  position: optionalText(120),
  phone: optionalText(60),
  idNumber: optionalText(60),
  startDate: z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null)),
  payFrequency: z.string().refine(isPayFrequency, "Choose monthly or weekly"),
  baseSalary: z.coerce.number({ message: "Enter the salary" }).min(0, "The salary can't be negative"),
  notes: optionalText(1000),
  nssfEnrolled: z.string().optional().transform((v) => v === "on"),
  taxExemption: z.coerce.number().min(0, "The exemption can't be negative").max(10_000_000).default(0),
});

export async function saveEmployee(companySlug: string, employeeId: string | null, _prev: PayrollFormState, formData: FormData): Promise<PayrollFormState> {
  const { slug, companyId } = await ctx(companySlug);
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = { ...parsed.data, baseSalary: round2(parsed.data.baseSalary), taxExemption: round2(parsed.data.taxExemption) };
  if (employeeId) {
    const updated = await prisma.employee.updateMany({ where: { id: employeeId, companyId }, data });
    if (!updated.count) return { error: "This employee no longer exists." };
  } else {
    await prisma.employee.create({ data: { ...data, companyId } });
  }
  updateTag(payrollTag(companyId));
  redirect(`/c/${slug}/staff?saved=1`);
}

/** Staff who leave are deactivated (kept for past payrolls), or brought back. */
export async function setEmployeeActive(companySlug: string, employeeId: string, active: boolean): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  await prisma.employee.updateMany({ where: { id: employeeId, companyId }, data: { active } });
  updateTag(payrollTag(companyId));
  return {};
}

// ── Payroll runs ──

const runSchema = z.object({
  frequency: z.string().refine(isPayFrequency, "Choose monthly or weekly"),
  period: z.string().min(7, "Choose the period"),
});

/** Start a payroll for a month or a week, with a line per active employee paid at that frequency. */
export async function createPayrollRun(companySlug: string, _prev: PayrollFormState, formData: FormData): Promise<PayrollFormState> {
  const { user, slug, companyId } = await ctx(companySlug);
  const parsed = runSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const frequency = parsed.data.frequency as PayFrequency;
  const period = payPeriod(frequency, parsed.data.period);
  if (!period) return { error: "Choose the period." };
  const [staff, rules] = await Promise.all([
    prisma.employee.findMany({ where: { companyId, active: true, payFrequency: frequency }, orderBy: { name: "asc" } }),
    getPayrollRules(slug),
  ]);
  if (!staff.length) return { error: `No active staff are paid ${frequency === "MONTHLY" ? "monthly" : "weekly"}. Add them on the Staff page first.` };

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        select: { id: true },
        data: {
          companyId,
          number: await nextNumber(tx, companyId, "PR", period.start.getUTCFullYear()),
          frequency,
          periodStart: period.start,
          periodEnd: period.end,
          label: period.label,
          createdById: user.id,
          lines: { create: staff.map((e) => newLine(e, frequency, rules)) },
        },
      });
      return run.id;
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: `There is already a payroll for ${period.label}.` };
    throw e;
  }
  updateTag(payrollTag(companyId));
  redirect(`/c/${slug}/payroll/${id}`);
}

const linesSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(
    z.object({
      id: z.string().min(1),
      baseSalary: z.number().min(0),
      bonus: z.number().min(0),
      overtime: z.number().min(0),
      deductions: z.number().min(0),
      advance: z.number().min(0),
      note: z.string().trim().max(300).optional(),
    }),
  ),
});

/** Save the amounts of a draft payroll. */
export async function savePayrollLines(companySlug: string, runId: string, _prev: PayrollFormState, formData: FormData): Promise<PayrollFormState> {
  const { slug, companyId } = await ctx(companySlug);
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = linesSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId },
    select: { status: true, frequency: true, lines: { select: { id: true, name: true, employee: { select: { nssfEnrolled: true, taxExemption: true } } } } },
  });
  if (!run) return { error: "This payroll no longer exists." };
  if (run.status !== "DRAFT") return { error: "Only a draft payroll can be changed. Reopen it first." };
  const rules = await getPayrollRules(slug);
  const known = new Map(run.lines.map((l) => [l.id, l]));
  const computed = new Map<string, ReturnType<typeof statutory>>();
  for (const l of parsed.data.lines) {
    const line = known.get(l.id);
    if (!line) return { error: "A line of this payroll no longer exists. Reload the page." };
    const st = statutory(lineGross(l), run.frequency as PayFrequency, rules, { nssfEnrolled: line.employee.nssfEnrolled, taxExemption: Number(line.employee.taxExemption) });
    computed.set(l.id, st);
    if (lineNet({ ...l, ...st }) < 0) return { error: `${line.name}'s pay would be negative. Check the deductions and advance.` };
  }
  await prisma.$transaction(async (tx) => {
    for (const l of parsed.data.lines) {
      await tx.payrollLine.update({
        where: { id: l.id },
        data: {
          baseSalary: round2(l.baseSalary),
          bonus: round2(l.bonus),
          overtime: round2(l.overtime),
          deductions: round2(l.deductions),
          advance: round2(l.advance),
          ...computed.get(l.id)!,
          net: lineNet({ ...l, ...computed.get(l.id)! }),
          note: l.note || null,
        },
      });
    }
    await tx.payrollRun.update({ where: { id: runId }, data: { notes: parsed.data.notes || null } });
  }, TRANSACTION_OPTIONS);
  updateTag(payrollTag(companyId));
  redirect(`/c/${slug}/payroll/${runId}?saved=1`);
}

/** Add active staff hired after the payroll was started (same frequency, not already on it). */
export async function addMissingStaff(companySlug: string, runId: string): Promise<{ error?: string; added?: number }> {
  const { companyId } = await ctx(companySlug);
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId }, select: { status: true, frequency: true, lines: { select: { employeeId: true } } } });
  if (!run) return { error: "This payroll no longer exists." };
  if (run.status !== "DRAFT") return { error: "Only a draft payroll can be changed." };
  const have = new Set(run.lines.map((l) => l.employeeId));
  const missing = (await prisma.employee.findMany({ where: { companyId, active: true, payFrequency: run.frequency } })).filter((e) => !have.has(e.id));
  if (missing.length) {
    const { slug } = await ctx(companySlug);
    const rules = await getPayrollRules(slug);
    await prisma.payrollLine.createMany({ data: missing.map((e) => ({ runId, ...newLine(e, run.frequency as PayFrequency, rules) })) });
    updateTag(payrollTag(companyId));
  }
  return { added: missing.length };
}

export async function removePayrollLine(companySlug: string, runId: string, lineId: string): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId }, select: { status: true } });
  if (!run) return { error: "This payroll no longer exists." };
  if (run.status !== "DRAFT") return { error: "Only a draft payroll can be changed." };
  await prisma.payrollLine.deleteMany({ where: { id: lineId, runId } });
  updateTag(payrollTag(companyId));
  return {};
}

/** Draft → Approved (locked, ready to print and sign) and back. */
export async function setPayrollStatus(companySlug: string, runId: string, status: "DRAFT" | "APPROVED"): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId }, select: { status: true, _count: { select: { lines: true } } } });
  if (!run) return { error: "This payroll no longer exists." };
  if (run.status === "PAID") return { error: "This payroll is paid. Undo the payment first." };
  if (status === "APPROVED" && !run._count.lines) return { error: "This payroll has nobody on it." };
  await prisma.payrollRun.update({ where: { id: runId }, data: { status } });
  updateTag(payrollTag(companyId));
  return {};
}

const paySchema = z.object({ payDate: day, moneyAccountId: z.string().min(1, "Choose the cash box or bank account") });

/** Pay an approved payroll: posts salaries, advances paid back and the money out. */
export async function payPayroll(companySlug: string, runId: string, _prev: PayrollFormState, formData: FormData): Promise<PayrollFormState> {
  const { user, slug, companyId } = await ctx(companySlug);
  const parsed = paySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const account = await prisma.ledgerAccount.findFirst({
    where: { id: parsed.data.moneyAccountId, companyId, kind: { in: ["CASH", "BANK"] }, active: true },
    select: { id: true },
  });
  if (!account) return { error: "Choose a cash box or bank account of this company." };
  const date = new Date(`${parsed.data.payDate}T00:00:00Z`);

  try {
    await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findFirst({ where: { id: runId, companyId }, include: { lines: true } });
      if (!run) throw new UserError("This payroll no longer exists.");
      if (run.status !== "APPROVED") throw new UserError(run.status === "PAID" ? "This payroll is already paid." : "Approve the payroll before paying it.");
      const lines = run.lines.map((l) => {
        const a = {
          baseSalary: Number(l.baseSalary), bonus: Number(l.bonus), overtime: Number(l.overtime), deductions: Number(l.deductions), advance: Number(l.advance),
          nssfEmployee: Number(l.nssfEmployee), incomeTax: Number(l.incomeTax),
        };
        return { name: l.name, gross: lineGross(a), advance: a.advance, nssfEmployee: a.nssfEmployee, nssfEmployer: Number(l.nssfEmployer), incomeTax: a.incomeTax, net: lineNet(a) };
      });
      await tx.payrollRun.update({ where: { id: run.id }, data: { status: "PAID", payDate: date, moneyAccountId: account.id } });
      await postPayroll(tx, { id: run.id, companyId, number: run.number, label: run.label, date, moneyAccountId: account.id, lines, createdById: user.id });
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  updateTag(payrollTag(companyId));
  updateTag(ledgerTag(companyId));
  redirect(`/c/${slug}/payroll/${runId}?paid=1`);
}

/** Undo a payment entered by mistake: removes its accounting entry, back to Approved. */
export async function undoPayrollPayment(companySlug: string, runId: string): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId }, select: { status: true } });
  if (!run || run.status !== "PAID") return { error: "This payroll isn't paid." };
  await prisma.$transaction(async (tx) => {
    await removeEntries(tx, "PAYROLL", runId);
    await tx.payrollRun.update({ where: { id: runId }, data: { status: "APPROVED", payDate: null, moneyAccountId: null } });
  }, TRANSACTION_OPTIONS);
  updateTag(payrollTag(companyId));
  updateTag(ledgerTag(companyId));
  return {};
}

export async function deletePayrollRun(companySlug: string, runId: string): Promise<{ error?: string }> {
  const { user, slug, companyId } = await ctx(companySlug);
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId }, select: { status: true, number: true, label: true } });
  if (!run) return { error: "This payroll no longer exists." };
  if (run.status === "PAID") return { error: "A paid payroll can't be deleted. Undo the payment first." };
  const refused = deleteRefusal(user, run.status === "DRAFT" ? "draft" : "posted");
  if (refused) return { error: refused };
  await prisma.$transaction(async (tx) => {
    await toRecycleBin(tx, { model: "PayrollRun", id: runId, companyId, label: `Payroll ${run.number} · ${run.label}`, deletedByName: user.name });
    await tx.payrollRun.delete({ where: { id: runId } });
  }, TRANSACTION_OPTIONS);
  updateTag(payrollTag(companyId));
  redirect(`/c/${slug}/payroll`);
}

/** A payroll line for an employee at their base salary, with NSSF and income tax worked out. */
function newLine(e: { id: string; name: string; position: string | null; baseSalary: unknown; nssfEnrolled: boolean; taxExemption: unknown }, frequency: PayFrequency, rules: PayrollRules) {
  const base = Number(e.baseSalary);
  const st = statutory(base, frequency, rules, { nssfEnrolled: e.nssfEnrolled, taxExemption: Number(e.taxExemption) });
  return { employeeId: e.id, name: e.name, position: e.position, baseSalary: base, ...st, net: lineNet({ baseSalary: base, bonus: 0, overtime: 0, deductions: 0, advance: 0, ...st }) };
}

const rate = (max: number) => z.coerce.number().min(0, "Rates can't be negative").max(max);
const settingsSchema = z.object({
  sicknessEmployee: rate(100),
  sicknessEmployer: rate(100),
  sicknessCap: rate(1_000_000),
  familyEmployer: rate(100),
  familyCap: rate(1_000_000),
  endOfService: rate(100),
  taxBrackets: z.string().max(2000),
  defaultExemption: rate(10_000_000),
});

/** NSSF rates and ceilings, and income-tax brackets (set by the accountant). */
export async function savePayrollSettings(companySlug: string, _prev: PayrollFormState, formData: FormData): Promise<PayrollFormState> {
  const { slug, companyId } = await ctx(companySlug);
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const bad = parsed.data.taxBrackets.split("\n").map((l) => l.trim()).filter(Boolean).find((l) => !/^(\*|[\d,.]+)\s+[\d.]+%?$/.test(l));
  if (bad) return { error: `Tax bracket line “${bad}”: write the yearly amount up to which it applies, then the rate (e.g. 18000 2), and “* 25” for the top rate.` };
  await prisma.payrollSettings.upsert({ where: { companyId }, create: { companyId, ...parsed.data }, update: parsed.data });
  updateTag(payrollTag(companyId));
  redirect(`/c/${slug}/payroll?settingsSaved=1`);
}

class UserError extends Error {}
