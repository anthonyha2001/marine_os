import "server-only";
import { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/prisma";
import { round2 } from "@/lib/money";

// Ledger sums in SQL, so balances and reports never load the whole ledger. The cached readers
// in src/lib/data/ledger.ts call these with the shared client; a transaction can be passed too.
// Dates are plain days (YYYY-MM-DD); null = no bound.

/** Entries of the company within an optional date range (SQL fragment on alias e). */
function inRange(companyId: string, from: string | null, to: string | null) {
  return Prisma.sql`e."companyId" = ${companyId}
    AND (${from}::date IS NULL OR e.date >= ${from}::date)
    AND (${to}::date IS NULL OR e.date <= ${to}::date)`;
}

const FROM_LINES = Prisma.sql`FROM "JournalLine" l JOIN "JournalEntry" e ON e.id = l."entryId" JOIN "LedgerAccount" a ON a.id = l."accountId"`;

/** Debit and credit per account. */
export async function sumByAccount(db: Tx, companyId: string, from: string | null, to: string | null) {
  const rows = await db.$queryRaw<{ accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal }[]>`
    SELECT l."accountId", SUM(l.debit) AS debit, SUM(l.credit) AS credit
    ${FROM_LINES}
    WHERE ${inRange(companyId, from, to)}
    GROUP BY l."accountId"`;
  return rows.map((r) => ({ accountId: r.accountId, debit: Number(r.debit), credit: Number(r.credit) }));
}

/** Debit and credit per month ("YYYY-MM") and account. */
export async function sumByMonth(db: Tx, companyId: string, from: string, to: string) {
  const rows = await db.$queryRaw<{ month: string; accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal }[]>`
    SELECT to_char(e.date, 'YYYY-MM') AS month, l."accountId", SUM(l.debit) AS debit, SUM(l.credit) AS credit
    ${FROM_LINES}
    WHERE ${inRange(companyId, from, to)}
    GROUP BY 1, 2`;
  return rows.map((r) => ({ month: r.month, accountId: r.accountId, debit: Number(r.debit), credit: Number(r.credit) }));
}

/** Which journal lines a ledger or a statement follows. */
export type MoveFilter = { kind: "account"; accountId: string } | { kind: "customer"; id: string | null; name: string } | { kind: "supplier"; id: string };

function moveMatch(f: MoveFilter) {
  if (f.kind === "account") return Prisma.sql`l."accountId" = ${f.accountId}`;
  if (f.kind === "supplier") return Prisma.sql`a.kind = 'PAYABLE' AND l."supplierId" = ${f.id}`;
  const name = f.name.trim().toLowerCase();
  // Customers without a saved record are followed by name.
  return f.id
    ? Prisma.sql`a.kind = 'RECEIVABLE' AND (l."customerId" = ${f.id} OR (l."customerId" IS NULL AND lower(btrim(l."customerName")) = ${name}))`
    : Prisma.sql`a.kind = 'RECEIVABLE' AND lower(btrim(l."customerName")) = ${name}`;
}

/** Lines matching the filter within the period (date order), and debit − credit before it. */
export async function moves(db: Tx, companyId: string, filter: MoveFilter, from: string | null, to: string | null) {
  const match = moveMatch(filter);
  const [opening, rows] = await Promise.all([
    from
      ? db.$queryRaw<{ amount: Prisma.Decimal | null }[]>`
          SELECT SUM(l.debit - l.credit) AS amount ${FROM_LINES}
          WHERE e."companyId" = ${companyId} AND e.date < ${from}::date AND ${match}`
      : Promise.resolve([{ amount: null }]),
    db.$queryRaw<
      { entryId: string; number: string; date: Date; memo: string; description: string | null; sourceType: string; sourceId: string | null; debit: Prisma.Decimal; credit: Prisma.Decimal }[]
    >`
      SELECT e.id AS "entryId", e.number, e.date, e.memo, l.description, e."sourceType", e."sourceId", l.debit, l.credit
      ${FROM_LINES}
      WHERE ${inRange(companyId, from, to)} AND ${match}
      ORDER BY e.date, e.number, l.id`,
  ]);
  return {
    opening: Number(opening[0]?.amount ?? 0),
    rows: rows.map((r) => ({ ...r, debit: Number(r.debit), credit: Number(r.credit) })),
  };
}

/** Debit and credit per customer (Customers 411; unsaved customers keyed "name:…") or per supplier (Suppliers 401). */
export async function sumByPartner(db: Tx, companyId: string, type: "CUSTOMER" | "SUPPLIER") {
  const rows =
    type === "CUSTOMER"
      ? await db.$queryRaw<{ id: string | null; key: string; name: string | null; debit: Prisma.Decimal; credit: Prisma.Decimal }[]>`
          SELECT l."customerId" AS id,
                 COALESCE(l."customerId", 'name:' || lower(btrim(COALESCE(l."customerName", 'Unknown customer')))) AS key,
                 MIN(l."customerName") AS name, SUM(l.debit) AS debit, SUM(l.credit) AS credit
          ${FROM_LINES}
          WHERE e."companyId" = ${companyId} AND a.kind = 'RECEIVABLE'
          GROUP BY 1, 2`
      : await db.$queryRaw<{ id: string; key: string; name: null; debit: Prisma.Decimal; credit: Prisma.Decimal }[]>`
          SELECT l."supplierId" AS id, l."supplierId" AS key, NULL AS name, SUM(l.debit) AS debit, SUM(l.credit) AS credit
          ${FROM_LINES}
          WHERE e."companyId" = ${companyId} AND a.kind = 'PAYABLE' AND l."supplierId" IS NOT NULL
          GROUP BY 1`;
  return rows.map((r) => ({ id: r.id, key: r.key, name: r.name, debit: Number(r.debit), credit: Number(r.credit) }));
}

/** Entries of a period that carry VAT, with their amount excl. VAT. */
export async function vatDocuments(db: Tx, companyId: string, from: string | null, to: string | null) {
  const rows = await db.$queryRaw<{ id: string; date: Date; number: string; memo: string; ht: Prisma.Decimal; vatOut: Prisma.Decimal; vatIn: Prisma.Decimal }[]>`
    SELECT e.id, e.date, e.number, e.memo,
      SUM(CASE WHEN a.kind = 'SALES' THEN l.credit - l.debit WHEN a.kind IN ('PURCHASES', 'EXPENSE') THEN l.debit - l.credit ELSE 0 END) AS ht,
      SUM(CASE WHEN a.kind = 'VAT_OUT' THEN l.credit - l.debit ELSE 0 END) AS "vatOut",
      SUM(CASE WHEN a.kind = 'VAT_IN' THEN l.debit - l.credit ELSE 0 END) AS "vatIn"
    ${FROM_LINES}
    WHERE ${inRange(companyId, from, to)}
    GROUP BY e.id, e.date, e.number, e.memo
    HAVING SUM(CASE WHEN a.kind = 'VAT_OUT' THEN l.credit - l.debit ELSE 0 END) <> 0
        OR SUM(CASE WHEN a.kind = 'VAT_IN' THEN l.debit - l.credit ELSE 0 END) <> 0
    ORDER BY e.date, e.number`;
  return rows.map((r) => ({ id: r.id, date: r.date, number: r.number, memo: r.memo, ht: round2(Number(r.ht)), vatOut: round2(Number(r.vatOut)), vatIn: round2(Number(r.vatIn)) }));
}
