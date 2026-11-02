import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DATA_TAG } from "@/lib/cache-tag";
import { companyIdFor } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import { salesTags } from "@/lib/data/sales";
import { round2 } from "@/lib/money";
import type { InvoiceStatus, OfferStatus } from "@/lib/offers";
import type { CompanySlug } from "@/lib/permissions";

// Long lists, one page at a time: search, count and page are done in SQL, and the summary
// figures above each list are SQL sums, so a list never loads every row.

export const LIST_PAGE_SIZE = 50;

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });
const skipTake = (page: number) => ({ skip: (page - 1) * LIST_PAGE_SIZE, take: LIST_PAGE_SIZE });

/**
 * What is still due on each non-cancelled invoice of the company: total − posted receipts −
 * issued credit notes (SQL, aliased "bal").
 */
export function invoiceBalances(companyId: string) {
  return Prisma.sql`
    SELECT i.id, i."customerId", i."customerName", i."dueDate",
      i."totalTTC"
        - COALESCE((SELECT SUM(r.amount) FROM "CustomerReceipt" r WHERE r."invoiceId" = i.id AND r.status = 'POSTED'), 0)
        - COALESCE((SELECT SUM(c."totalTTC") FROM "CreditNote" c WHERE c."invoiceId" = i.id AND c.status = 'ISSUED'), 0) AS balance
    FROM "Invoice" i
    WHERE i."companyId" = ${companyId} AND i.status <> 'CANCELLED'`;
}

// ── Invoices ──

async function loadInvoicePage(companyId: string, q: string, page: number) {
  "use cache";
  cacheTag(DATA_TAG, salesTags.invoices(companyId), ledgerTag(companyId));
  cacheLife("hours");
  const where: Prisma.InvoiceWhereInput = {
    companyId,
    ...(q ? { OR: [{ number: contains(q) }, { customerName: contains(q) }, { offer: { number: contains(q) } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      select: { id: true, number: true, customerId: true, customerName: true, invoiceDate: true, dueDate: true, status: true, totalTTC: true, offer: { select: { id: true, number: true } } },
      orderBy: [{ invoiceDate: "desc" }, { number: "desc" }],
      ...skipTake(page),
    }),
  ]);
  const ids = rows.map((r) => r.id);
  const [paid, credited] = await Promise.all([
    prisma.customerReceipt.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: ids }, status: "POSTED" }, _sum: { amount: true } }),
    prisma.creditNote.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: ids }, status: "ISSUED" }, _sum: { totalTTC: true } }),
  ]);
  const settled = new Map<string, number>();
  for (const p of paid) settled.set(p.invoiceId!, Number(p._sum.amount ?? 0));
  for (const c of credited) settled.set(c.invoiceId!, (settled.get(c.invoiceId!) ?? 0) + Number(c._sum.totalTTC ?? 0));
  return {
    total,
    rows: rows.map((i) => {
      const totalTTC = Number(i.totalTTC);
      const done = round2(settled.get(i.id) ?? 0);
      return { ...i, status: i.status as InvoiceStatus, totalTTC, settled: done, balance: i.status === "CANCELLED" ? 0 : Math.max(0, round2(totalTTC - done)) };
    }),
  };
}

/** One page of invoices (newest first) with what was settled and is still due, searched by number, customer or offer. */
export async function invoicePage(slug: CompanySlug, q: string, page: number) {
  return loadInvoicePage(await companyIdFor(slug), q.trim(), page);
}

async function loadInvoiceSummary(companyId: string, today: string) {
  "use cache";
  cacheTag(DATA_TAG, salesTags.invoices(companyId), ledgerTag(companyId));
  cacheLife("hours");
  const [row] = await prisma.$queryRaw<{ issued: number; openCount: number; openSum: Prisma.Decimal; overdueCount: number; overdueSum: Prisma.Decimal }[]>`
    WITH bal AS (${invoiceBalances(companyId)})
    SELECT count(*)::int AS issued,
      (count(*) FILTER (WHERE balance > 0.004))::int AS "openCount",
      COALESCE(SUM(balance) FILTER (WHERE balance > 0.004), 0) AS "openSum",
      (count(*) FILTER (WHERE balance > 0.004 AND "dueDate" < ${today}::date))::int AS "overdueCount",
      COALESCE(SUM(balance) FILTER (WHERE balance > 0.004 AND "dueDate" < ${today}::date), 0) AS "overdueSum"
    FROM bal`;
  return { issued: row.issued, openCount: row.openCount, openSum: round2(Number(row.openSum)), overdueCount: row.overdueCount, overdueSum: round2(Number(row.overdueSum)) };
}

/** Invoices issued (not cancelled), unpaid and overdue, for the summary cards. */
export async function invoiceSummary(slug: CompanySlug, today: string) {
  return loadInvoiceSummary(await companyIdFor(slug), today);
}

// ── Offers ──

async function loadOfferPage(companyId: string, q: string, page: number) {
  "use cache";
  cacheTag(DATA_TAG, salesTags.offers(companyId), salesTags.invoices(companyId));
  cacheLife("hours");
  const where: Prisma.OfferWhereInput = { companyId, ...(q ? { OR: [{ number: contains(q) }, { customerName: contains(q) }, { subject: contains(q) }] } : {}) };
  const [total, rows] = await Promise.all([
    prisma.offer.count({ where }),
    prisma.offer.findMany({
      where,
      select: {
        id: true, number: true, customerId: true, customerName: true, subject: true, offerDate: true, validUntil: true, status: true, totalTTC: true, totalHT: true,
        // Any invoice (even cancelled) blocks deleting the offer; non-cancelled ones count as invoiced.
        invoices: { select: { status: true, totalTTC: true } },
      },
      orderBy: [{ offerDate: "desc" }, { createdAt: "desc" }],
      ...skipTake(page),
    }),
  ]);
  return {
    total,
    rows: rows.map(({ invoices, ...o }) => ({
      ...o,
      status: o.status as OfferStatus,
      totalTTC: Number(o.totalTTC),
      totalHT: Number(o.totalHT),
      invoiceCount: invoices.length,
      invoicedTTC: invoices.filter((i) => i.status !== "CANCELLED").reduce((sum, i) => sum + Number(i.totalTTC), 0),
    })),
  };
}

/** One page of offers (newest first), searched by number, customer or subject. */
export async function offerPage(slug: CompanySlug, q: string, page: number) {
  return loadOfferPage(await companyIdFor(slug), q.trim(), page);
}

// ── Receipts ──

async function loadReceiptPage(companyId: string, q: string, page: number) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  const where: Prisma.CustomerReceiptWhereInput = {
    companyId,
    ...(q ? { OR: [{ number: contains(q) }, { customerName: contains(q) }, { invoice: { number: contains(q) } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.customerReceipt.count({ where }),
    prisma.customerReceipt.findMany({
      where,
      include: { invoice: { select: { id: true, number: true } }, moneyAccount: { select: { code: true, name: true } }, createdBy: { select: { name: true } } },
      orderBy: [{ receivedAt: "desc" }, { number: "desc" }],
      ...skipTake(page),
    }),
  ]);
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      invoice: r.invoice,
      customerId: r.customerId,
      customerName: r.customerName,
      amount: Number(r.amount),
      receivedAt: r.receivedAt,
      method: r.method,
      moneyAccount: `${r.moneyAccount.code} ${r.moneyAccount.name}`,
      reference: r.reference,
      notes: r.notes,
      createdByName: r.createdBy.name,
      status: r.status as "POSTED" | "CANCELLED",
      cancelReason: r.cancelReason,
      cancelledByName: r.cancelledByName,
    })),
  };
}

/** One page of receipts (newest first), searched by number, customer or invoice. */
export async function receiptPage(slug: CompanySlug, q: string, page: number) {
  return loadReceiptPage(await companyIdFor(slug), q.trim(), page);
}

async function loadReceiptSummary(companyId: string, month: string) {
  "use cache";
  cacheTag(DATA_TAG, ledgerTag(companyId));
  cacheLife("hours");
  const [row] = await prisma.$queryRaw<{ thisMonth: Prisma.Decimal; onAccount: Prisma.Decimal }[]>`
    SELECT COALESCE(SUM(amount) FILTER (WHERE to_char("receivedAt", 'YYYY-MM') = ${month}), 0) AS "thisMonth",
           COALESCE(SUM(amount) FILTER (WHERE "invoiceId" IS NULL), 0) AS "onAccount"
    FROM "CustomerReceipt" WHERE "companyId" = ${companyId} AND status = 'POSTED'`;
  return { thisMonth: round2(Number(row.thisMonth)), onAccount: round2(Number(row.onAccount)) };
}

/** Posted receipts this month ("YYYY-MM") and money received on account (no invoice). */
export async function receiptSummary(slug: CompanySlug, month: string) {
  return loadReceiptSummary(await companyIdFor(slug), month);
}

// ── Customers (shared by both companies; balances are this company's invoices) ──

export type CustomerSort = "name" | "due";

type CustomerRow = { id: string; name: string; contactName: string | null; phone: string | null; email: string | null; due: Prisma.Decimal; overdue: Prisma.Decimal; unpaidCount: number };

/** Customers with what they owe this company (by customer, or by name for invoices without a saved customer). */
export function customersWithDue(companyId: string, today: string, q: string) {
  const search = q ? Prisma.sql`AND (c.name ILIKE ${`%${q}%`} OR c."contactName" ILIKE ${`%${q}%`} OR c.phone ILIKE ${`%${q}%`} OR c.email ILIKE ${`%${q}%`})` : Prisma.empty;
  return Prisma.sql`
    WITH bal AS (${invoiceBalances(companyId)}),
    owed AS (
      SELECT COALESCE("customerId", 'name:' || lower(btrim("customerName"))) AS key,
             SUM(balance) AS due, COALESCE(SUM(balance) FILTER (WHERE "dueDate" < ${today}::date), 0) AS overdue, count(*)::int AS n
      FROM bal WHERE balance > 0.004 GROUP BY 1
    )
    SELECT c.id, c.name, c."contactName", c.phone, c.email,
           COALESCE(a.due, 0) + COALESCE(b.due, 0) AS due,
           COALESCE(a.overdue, 0) + COALESCE(b.overdue, 0) AS overdue,
           (COALESCE(a.n, 0) + COALESCE(b.n, 0))::int AS "unpaidCount"
    FROM "Customer" c
    LEFT JOIN owed a ON a.key = c.id
    LEFT JOIN owed b ON b.key = 'name:' || lower(btrim(c.name))
    WHERE true ${search}`;
}

async function loadCustomerPage(companyId: string, today: string, q: string, sort: CustomerSort, page: number) {
  "use cache";
  cacheTag(DATA_TAG, salesTags.customers, salesTags.invoices(companyId), ledgerTag(companyId));
  cacheLife("hours");
  const base = customersWithDue(companyId, today, q);
  const order = sort === "due" ? Prisma.sql`ORDER BY due DESC, name` : Prisma.sql`ORDER BY name`;
  const [rows, [summary]] = await Promise.all([
    prisma.$queryRaw<CustomerRow[]>`${base} ${order} LIMIT ${LIST_PAGE_SIZE} OFFSET ${(page - 1) * LIST_PAGE_SIZE}`,
    prisma.$queryRaw<{ total: number; owing: number; due: Prisma.Decimal; overdue: Prisma.Decimal }[]>`
      SELECT count(*)::int AS total, (count(*) FILTER (WHERE due > 0.004))::int AS owing,
             COALESCE(SUM(due), 0) AS due, COALESCE(SUM(overdue), 0) AS overdue
      FROM (${base}) x`,
  ]);
  return {
    total: summary.total,
    owing: summary.owing,
    totalDue: round2(Number(summary.due)),
    totalOverdue: round2(Number(summary.overdue)),
    rows: rows.map((r) => ({ ...r, balance: { due: round2(Number(r.due)), overdue: round2(Number(r.overdue)), unpaidCount: r.unpaidCount } })),
  };
}

/** One page of customers, by name or by amount due, with the totals over every customer matching the search. */
export async function customerPage(slug: CompanySlug, today: string, q: string, sort: CustomerSort, page: number) {
  return loadCustomerPage(await companyIdFor(slug), today, q.trim(), sort, page);
}
