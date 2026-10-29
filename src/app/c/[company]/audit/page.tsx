import { Suspense } from "react";
import { History } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { parseDay, parseDayEnd } from "@/lib/dates";
import { COMPANIES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyState, PageHeader, cardClass, inputClass, secondaryButton, tdClass, thClass } from "@/components/ui";

type Search = { user?: string; entity?: string; q?: string; from?: string; to?: string };
const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Beirut" });
const TONE = { CREATE: "green", UPDATE: "blue", DELETE: "red" } as const;
const ACTION = { CREATE: "Created", UPDATE: "Changed", DELETE: "Deleted" } as const;
const ENTITY: Record<string, string> = {
  Invoice: "Invoice", Offer: "Offer", CreditNote: "Credit note", CustomerReceipt: "Customer receipt", Voucher: "Voucher", SupplierPayment: "Supplier payment",
  Purchase: "Purchase", PurchaseOrder: "Purchase order", Product: "Product / service", Customer: "Customer", Supplier: "Supplier", Vessel: "Vessel", User: "User",
  Company: "Company details", LedgerAccount: "Account", PayrollRun: "Payroll", Employee: "Employee", Cheque: "Cheque", BankReconciliation: "Bank reconciliation",
  LandedCost: "Landed cost", ProductSerial: "Serial number", PosSale: "Counter sale", PosRefund: "Counter refund", PosShift: "Till shift", ExchangeRate: "Exchange rate",
  StockCount: "Stock count", StockTransfer: "Transfer", JobCard: "Job card", Warranty: "Warranty", Appointment: "Appointment",
};

async function AuditContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "audit");
  const base = `/c/${slug}/audit`;
  const companyId = await companyIdFor(slug);
  const from = parseDay(search.from);
  const to = parseDayEnd(search.to);
  const q = (search.q ?? "").trim();
  // Read fresh: this is the record of what happened.
  const [rows, users] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        OR: [{ companyId }, { companyId: null }],
        ...(search.user ? { userId: search.user } : {}),
        ...(search.entity ? { entity: search.entity } : {}),
        ...(q ? { OR: [{ label: { contains: q, mode: "insensitive" } }, { details: { contains: q, mode: "insensitive" } }] } : {}),
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Audit log"
        description="Who created, changed or deleted what, and when. Written automatically for invoices, offers, payments, stock, staff and settings. Shared records (products, customers…) appear in both companies."
      />
      <form action={base} className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted">
          Person
          <select name="user" defaultValue={search.user ?? ""} className={`${inputClass} mt-1 h-9 w-48`}>
            <option value="">Everyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Record type
          <select name="entity" defaultValue={search.entity ?? ""} className={`${inputClass} mt-1 h-9 w-48`}>
            <option value="">All</option>
            {Object.entries(ENTITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Number / name
          <input name="q" defaultValue={q} placeholder="e.g. XM-INV-2026-0003" className={`${inputClass} mt-1 h-9 w-56`} />
        </label>
        <label className="text-xs font-medium text-muted">
          From
          <input type="date" name="from" defaultValue={search.from} className={`${inputClass} mt-1 h-9 w-40`} />
        </label>
        <label className="text-xs font-medium text-muted">
          To
          <input type="date" name="to" defaultValue={search.to} className={`${inputClass} mt-1 h-9 w-40`} />
        </label>
        <button type="submit" className={`${secondaryButton} h-9`}>
          Filter
        </button>
      </form>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {rows.length === 0 ? (
          <EmptyState icon={History} title="Nothing recorded for this filter" />
        ) : (
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>When</th>
                <th className={thClass}>Who</th>
                <th className={thClass}>Action</th>
                <th className={thClass}>Record</th>
                <th className={thClass}>Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${tdClass} whitespace-nowrap text-muted`}>{stamp.format(r.createdAt)}</td>
                  <td className={`${tdClass} font-medium text-navy`}>{r.userName ?? (r.userId ? "—" : "Customer / system")}</td>
                  <td className={tdClass}>
                    <Badge tone={TONE[r.action as keyof typeof TONE] ?? "gray"}>{ACTION[r.action as keyof typeof ACTION] ?? r.action}</Badge>
                  </td>
                  <td className={tdClass}>
                    <span className="text-xs text-muted">{ENTITY[r.entity] ?? r.entity}</span> <span className="font-medium text-navy">{r.label ?? "—"}</span>
                  </td>
                  <td className={`${tdClass} text-muted`}>{r.details ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {rows.length === 300 && <p className="mt-2 text-xs text-muted">Showing the latest 300. Narrow the filter to see older entries.</p>}
    </>
  );
}

export default function AuditPage({ params, searchParams }: PageProps<"/c/[company]/audit">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the audit log…</p>}>
      <AuditContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
