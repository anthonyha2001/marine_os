import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import { lineGross, lineNet, parseBrackets, type PayFrequency, type PayrollRules, type RunStatus } from "@/lib/payroll";
import { round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";
import { DATA_TAG } from "@/lib/cache-tag";

// Staff and payroll, cached per company. Every payroll action calls updateTag(payrollTag(companyId)).
export const payrollTag = (companyId: string) => `payroll:${companyId}`;

async function loadEmployees(companyId: string) {
  "use cache";
  cacheTag(DATA_TAG, payrollTag(companyId));
  cacheLife("hours");
  const rows = await prisma.employee.findMany({ where: { companyId }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    position: e.position,
    phone: e.phone,
    idNumber: e.idNumber,
    startDate: e.startDate,
    payFrequency: e.payFrequency as PayFrequency,
    baseSalary: Number(e.baseSalary),
    nssfEnrolled: e.nssfEnrolled,
    taxExemption: Number(e.taxExemption),
    active: e.active,
    notes: e.notes,
  }));
}

export async function listEmployees(slug: CompanySlug) {
  return loadEmployees(await companyIdFor(slug));
}
export type EmployeeRow = Awaited<ReturnType<typeof loadEmployees>>[number];

async function loadRuns(companyId: string) {
  "use cache";
  cacheTag(DATA_TAG, payrollTag(companyId));
  cacheLife("hours");
  const rows = await prisma.payrollRun.findMany({
    where: { companyId },
    include: {
      lines: { orderBy: { name: "asc" } },
      moneyAccount: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ periodStart: "desc" }, { number: "desc" }],
  });
  return rows.map((r) => {
    const lines = r.lines.map((l) => {
      const amounts = {
        baseSalary: Number(l.baseSalary),
        bonus: Number(l.bonus),
        overtime: Number(l.overtime),
        deductions: Number(l.deductions),
        advance: Number(l.advance),
        nssfEmployee: Number(l.nssfEmployee),
        incomeTax: Number(l.incomeTax),
      };
      return { id: l.id, employeeId: l.employeeId, name: l.name, position: l.position, note: l.note, ...amounts, nssfEmployer: Number(l.nssfEmployer), gross: lineGross(amounts), net: lineNet(amounts) };
    });
    return {
      id: r.id,
      number: r.number,
      frequency: r.frequency as PayFrequency,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      label: r.label,
      status: r.status as RunStatus,
      payDate: r.payDate,
      moneyAccount: r.moneyAccount ? `${r.moneyAccount.code} ${r.moneyAccount.name}` : null,
      notes: r.notes,
      createdByName: r.createdBy.name,
      lines,
      totalGross: round2(lines.reduce((s, l) => s + l.gross, 0)),
      totalAdvance: round2(lines.reduce((s, l) => s + l.advance, 0)),
      totalNssfEmployee: round2(lines.reduce((s, l) => s + l.nssfEmployee, 0)),
      totalNssfEmployer: round2(lines.reduce((s, l) => s + l.nssfEmployer, 0)),
      totalIncomeTax: round2(lines.reduce((s, l) => s + l.incomeTax, 0)),
      totalNet: round2(lines.reduce((s, l) => s + l.net, 0)),
    };
  });
}

export async function listPayrollRuns(slug: CompanySlug) {
  return loadRuns(await companyIdFor(slug));
}
export type PayrollRunRow = Awaited<ReturnType<typeof loadRuns>>[number];

export async function getPayrollRun(slug: CompanySlug, id: string) {
  return (await listPayrollRuns(slug)).find((r) => r.id === id) ?? null;
}

/**
 * Advances each employee still owes: PV vouchers charged to Staff advances (425) whose
 * paid-to name matches the employee, minus what payroll already took back. A guide for
 * the "Advance" column, not a hard rule.
 */
export async function outstandingAdvances(slug: CompanySlug) {
  const companyId = await companyIdFor(slug);
  const [given, repaid] = await Promise.all([
    prisma.voucher.findMany({
      where: { companyId, status: "POSTED", kind: "PAYMENT", counterAccount: { code: "425" } },
      select: { partyName: true, amount: true },
    }),
    prisma.payrollLine.groupBy({ by: ["employeeId"], where: { run: { companyId, status: "PAID" } }, _sum: { advance: true } }),
  ]);
  const byName = new Map<string, number>();
  for (const v of given) {
    const key = (v.partyName ?? "").trim().toLowerCase();
    if (key) byName.set(key, round2((byName.get(key) ?? 0) + Number(v.amount)));
  }
  return { byName, repaid: new Map(repaid.map((r) => [r.employeeId, Number(r._sum.advance ?? 0)])) };
}

/** The company's NSSF / income-tax rules (defaults until the accountant saves their own). */
export async function getPayrollRules(slug: CompanySlug): Promise<PayrollRules & { saved: boolean; bracketsText: string }> {
  return loadRules(await companyIdFor(slug));
}

async function loadRules(companyId: string) {
  "use cache";
  cacheTag(DATA_TAG, payrollTag(companyId));
  cacheLife("hours");
  const r = await prisma.payrollSettings.findUnique({ where: { companyId } });
  const n = (v: unknown, d: number) => (v === undefined || v === null ? d : Number(v));
  return {
    saved: !!r,
    sicknessEmployee: n(r?.sicknessEmployee, 3),
    sicknessEmployer: n(r?.sicknessEmployer, 8),
    sicknessCap: n(r?.sicknessCap, 0),
    familyEmployer: n(r?.familyEmployer, 6),
    familyCap: n(r?.familyCap, 0),
    endOfService: n(r?.endOfService, 8.5),
    bracketsText: r?.taxBrackets ?? "",
    brackets: parseBrackets(r?.taxBrackets ?? ""),
    defaultExemption: n(r?.defaultExemption, 0),
  };
}
