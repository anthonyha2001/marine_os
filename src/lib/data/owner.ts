import "server-only";
import { averageCosts } from "@/lib/costing";
import { listBills } from "@/lib/data/accounting";
import { listAppointments } from "@/lib/data/appointments";
import { isOpenCheque, listCheques } from "@/lib/data/cheques";
import { companyIdFor, listProductsWithStock } from "@/lib/data/inventory";
import { getLedger, invoicesWithBalance } from "@/lib/data/ledger";
import { listSales } from "@/lib/data/pos";
import { profitReport } from "@/lib/data/profit";
import { listOffers } from "@/lib/data/sales";
import { listJobCards } from "@/lib/data/workshop";
import { businessToday } from "@/lib/dates";
import { accountTotals, moneyBalances, profitAndLoss } from "@/lib/ledger/reports";
import { round2 } from "@/lib/money";
import { hasPos } from "@/lib/pos";
import type { CompanySlug } from "@/lib/permissions";

const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/** Everything the owner wants at a glance for one company: sales, profit, cash, who owes what. */
export async function ownerSummary(slug: CompanySlug) {
  const today = businessToday();
  const now = new Date(`${today}T23:59:59Z`);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const monthStart = new Date(Date.UTC(year, month, 1));
  const lastMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const lastMonthEnd = new Date(monthStart.getTime() - 1);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekEnd = new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const companyId = await companyIdFor(slug);
  const [ledger, invoices, bills, cheques, products, costs, jobs, appointments, offers, sales, profit] = await Promise.all([
    getLedger(slug),
    invoicesWithBalance(slug),
    listBills(slug),
    listCheques(slug),
    listProductsWithStock(slug),
    averageCosts(companyId),
    listJobCards(slug),
    listAppointments(slug),
    listOffers(slug),
    hasPos(slug) ? listSales(slug) : Promise.resolve([]),
    profitReport(slug, { from: yearStart, to: now }),
  ]);

  // Sales = what the sales account (701) earned, net of credit notes and refunds (excl. VAT).
  const salesIn = (from: Date, to: Date) =>
    round2(accountTotals(ledger, { from, to }).filter((a) => a.kind === "SALES").reduce((s, a) => s + a.balance, 0));
  const expensesIn = (from: Date, to: Date) =>
    round2(accountTotals(ledger, { from, to }).filter((a) => a.type === "EXPENSE").reduce((s, a) => s + a.balance, 0));
  const series = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(Date.UTC(year, month - 11 + i, 1));
    const end = new Date(Date.UTC(year, month - 10 + i, 1) - 1);
    return { label: monthLabel.format(start), invoiced: salesIn(start, end), purchases: expensesIn(start, end) };
  });
  const pl = profitAndLoss(ledger, { from: yearStart, to: now });
  const money = moneyBalances(ledger).filter((a) => a.active || a.balance !== 0);
  const open = invoices.filter((i) => i.balance > 0);
  const overdue = open.filter((i) => i.dueDate.toISOString().slice(0, 10) < today);
  const openBills = bills.filter((b) => b.balance > 0);

  // Best customers this year: invoices (excl. cancelled) and named counter sales.
  const customers = new Map<string, number>();
  for (const i of invoices) if (i.invoiceDate >= yearStart) customers.set(i.customerName, round2((customers.get(i.customerName) ?? 0) + i.totalTTC));
  for (const s of sales)
    if (s.saleDate >= yearStart && s.customerName !== "Walk-in customer") customers.set(s.customerName, round2((customers.get(s.customerName) ?? 0) + s.totalTTC));

  return {
    slug,
    salesThisMonth: salesIn(monthStart, now),
    salesLastMonth: salesIn(lastMonthStart, lastMonthEnd),
    salesYear: round2(pl.totalIncome),
    profitYear: pl.net,
    grossProfitYear: round2(profit.jobs.total.profit + profit.sales.total.profit + profit.offers.total.profit),
    series,
    cash: round2(money.reduce((s, a) => s + a.balance, 0)),
    moneyAccounts: money.map((a) => ({ name: `${a.code} ${a.name}`, balance: a.balance })),
    toCollect: round2(open.reduce((s, i) => s + i.balance, 0)),
    overdue: round2(overdue.reduce((s, i) => s + i.balance, 0)),
    toPay: round2(openBills.reduce((s, b) => s + b.balance, 0)),
    chequesIn: round2(cheques.filter((c) => c.direction === "RECEIVED" && isOpenCheque(c)).reduce((s, c) => s + c.amount, 0)),
    chequesOut: round2(cheques.filter((c) => c.direction === "ISSUED" && isOpenCheque(c)).reduce((s, c) => s + c.amount, 0)),
    chequesDueWeek: cheques.filter((c) => isOpenCheque(c) && c.dueDate.toISOString().slice(0, 10) <= weekEnd).length,
    stockValue: round2(products.reduce((s, p) => s + Math.max(0, p.stock) * (costs.get(p.id) ?? 0), 0)),
    openJobs: jobs.filter((j) => j.status === "OPEN" || j.status === "IN_PROGRESS").length,
    appointmentsWeek: appointments.filter((a) => (a.status === "CONFIRMED" || a.status === "REQUESTED") && a.date.toISOString().slice(0, 10) >= today && a.date.toISOString().slice(0, 10) <= weekEnd).length,
    pipeline: round2(offers.filter((o) => o.status === "SENT").reduce((s, o) => s + o.totalTTC, 0)),
    topCustomers: [...customers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, total]) => ({ name, total })),
    topProducts: profit.products.rows.slice(0, 5).map((p) => ({ name: p.name, profit: p.profit, units: p.units })),
  };
}
export type OwnerSummary = Awaited<ReturnType<typeof ownerSummary>>;
