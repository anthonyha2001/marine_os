import type { PrismaClient } from "@prisma/client";

// Audit log: every create / change / delete of an important record is written to AuditLog with
// who did it. Entries are collected during the request and saved after the response is sent
// (next/server `after`), so users never wait for them.

export const AUDITED = new Set([
  "Invoice", "Offer", "CreditNote", "CustomerReceipt", "Voucher", "SupplierPayment", "Purchase", "PurchaseOrder",
  "Product", "Customer", "Supplier", "Vessel", "User", "Company", "LedgerAccount",
  "PayrollRun", "Employee", "Cheque", "BankReconciliation", "LandedCost", "ProductSerial",
  "PosSale", "PosRefund", "PosShift", "ExchangeRate", "StockCount", "StockTransfer",
  "JobCard", "Warranty", "Appointment",
]);
const WRITES = new Set(["create", "update", "upsert", "delete", "createMany", "updateMany", "deleteMany"]);
const IGNORED_FIELDS = new Set(["updatedAt", "lastLoginAt", "passwordHash"]);

type Entry = { model: string; operation: string; id: string | null; before: Record<string, unknown> | null; data: Record<string, unknown> | null; count: number | null };

const delegate = (model: string) => model[0].toLowerCase() + model.slice(1);
const pickLabel = (r: Record<string, unknown> | null) =>
  (r && ((r.number as string) ?? (r.invoiceNumber as string) ?? (r.name as string) ?? (r.serialNumber as string) ?? (r.email as string) ?? (r.label as string) ?? (r.customerName as string) ?? (r.description as string))) || null;

function describe(e: Entry) {
  if (e.count !== null) return `${e.count} record${e.count === 1 ? "" : "s"}`;
  if (e.operation === "delete" || !e.data) return null;
  const keys = Object.keys(e.data).filter((k) => !IGNORED_FIELDS.has(k) && typeof e.data![k] !== "object");
  if (e.operation === "update" && "status" in e.data) return `status → ${String(e.data.status)}`;
  if (e.operation === "update" && "active" in e.data) return e.data.active ? "reactivated" : "deactivated";
  return e.operation === "update" && keys.length ? `changed: ${keys.slice(0, 8).join(", ")}` : null;
}

/**
 * Wrap a Prisma client's queries: after each audited write, remember it. `base` is the plain client
 * used to read labels and write the log (never audited itself).
 */
export function auditQuery(base: PrismaClient) {
  /** The signed-in user of the current request (null in scripts or for customer-portal actions). */
  async function currentUserId() {
    try {
      const { cookies } = await import("next/headers");
      const { SESSION_COOKIE, verifySession } = await import("@/lib/session-token");
      return await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
    } catch {
      return null;
    }
  }

  async function flush(entries: Entry[], userId: string | null) {
    const user = userId ? await base.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
    const rows = [];
    for (const e of entries) {
      let row = e.before;
      if (e.id && e.operation !== "delete") {
        row = (await (base as unknown as Record<string, { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> }>)[delegate(e.model)]
          .findUnique({ where: { id: e.id } })
          .catch(() => null)) as Record<string, unknown> | null;
        if (!row && e.operation === "create") continue; // rolled back
      }
      if (e.model === "User" && e.operation === "update" && e.data && Object.keys(e.data).every((k) => IGNORED_FIELDS.has(k))) continue; // logins
      rows.push({
        companyId: ((row?.companyId as string) ?? (row?.fromCompanyId as string) ?? (e.model === "Company" ? e.id : null)) || null,
        userId,
        userName: user?.name ?? null,
        action: e.operation.startsWith("create") || e.operation === "upsert" ? "CREATE" : e.operation.startsWith("delete") ? "DELETE" : "UPDATE",
        entity: e.model,
        entityId: e.id,
        label: pickLabel(row) ?? pickLabel(e.data),
        details: describe(e),
      });
    }
    if (rows.length) await base.auditLog.createMany({ data: rows });
  }

  /** Save after the response is sent; outside a request, save straight away. */
  async function schedule(entry: Entry, userId: string | null) {
    const run = () => flush([entry], userId).catch((err) => console.error("audit log", err));
    try {
      const { after } = await import("next/server");
      after(run);
    } catch {
      void run();
    }
  }

  return async function onQuery({ model, operation, args, query }: { model?: string; operation: string; args: unknown; query: (a: unknown) => Promise<unknown> }) {
    if (!model || !AUDITED.has(model) || !WRITES.has(operation)) return query(args);
    const a = args as { where?: { id?: string }; data?: Record<string, unknown>; create?: Record<string, unknown> };
    let before: Record<string, unknown> | null = null;
    if (operation === "delete" && a.where?.id) {
      before = (await (base as unknown as Record<string, { findUnique: (x: unknown) => Promise<Record<string, unknown> | null> }>)[delegate(model)]
        .findUnique({ where: { id: a.where.id } })
        .catch(() => null)) as Record<string, unknown> | null;
    }
    const result = (await query(args)) as Record<string, unknown> | null;
    const many = operation.endsWith("Many");
    const entry: Entry = {
      model,
      operation,
      id: many ? null : ((result?.id as string) ?? a.where?.id ?? null),
      before,
      data: (a.data ?? a.create ?? null) as Record<string, unknown> | null,
      count: many ? Number((result as { count?: number } | null)?.count ?? 0) : null,
    };
    await schedule(entry, await currentUserId());
    return result;
  };
}
