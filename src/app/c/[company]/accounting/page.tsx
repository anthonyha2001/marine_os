import { Suspense } from "react";
import Link from "next/link";
import { payHref } from "@/lib/url";
import { requireModule } from "@/lib/auth";
import { billStatus } from "@/lib/accounting";
import { listBills } from "@/lib/data/accounting";
import { listPurchaseOrders } from "@/lib/data/purchase-orders";
import { getLedger, invoicesWithBalance } from "@/lib/data/ledger";
import { moneyBalances } from "@/lib/ledger/reports";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES, canAccessModule } from "@/lib/permissions";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, HandCoins } from "lucide-react";
import { PageHeader, cardClass, primaryButton, secondaryButton, secondaryButtonSm, ProgressBar } from "@/components/ui";
import { BillStatusBadge } from "./bill-status";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

function Card({ label, value, hint, tone = "navy" }: { label: string; value: string; hint: string; tone?: "navy" | "danger" | "success" }) {
  const color = { navy: "text-navy", danger: "text-danger", success: "text-success" }[tone];
  return (
    <div className={`${cardClass} p-4`}>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function SectionTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      {children}
    </div>
  );
}

async function AccountingContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ bills?: string }>;
}) {
  const [{ company }, { bills: billsView = "open" }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "accounting");
  const showReceivables = canAccessModule(user, slug, "invoices");
  const [bills, orders, invoices, ledger] = await Promise.all([
    listBills(slug),
    listPurchaseOrders(slug),
    showReceivables ? invoicesWithBalance(slug) : [],
    getLedger(slug),
  ]);
  const money = moneyBalances(ledger).filter((a) => a.active || a.balance !== 0);
  const fin = `/c/${slug}/finance`;
  const here = `/c/${slug}/accounting`;
  const base = `/c/${slug}/accounting`;
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // Supplier side
  const withStatus = bills.map((b) => ({ ...b, status: billStatus(b.total, b.paid, b.dueDate, today) }));
  const openBills = withStatus.filter((b) => b.balance > 0);
  const toPay = round2(openBills.reduce((s, b) => s + b.balance, 0));
  const overduePay = round2(openBills.filter((b) => b.status === "OVERDUE").reduce((s, b) => s + b.balance, 0));
  const shownBills = billsView === "all" ? withStatus : openBills;
  const bySupplier = [...openBills.reduce((m, b) => {
    const row = m.get(b.supplierId) ?? { name: b.supplierName, owed: 0, overdue: 0, count: 0 };
    row.owed = round2(row.owed + b.balance);
    if (b.status === "OVERDUE") row.overdue = round2(row.overdue + b.balance);
    row.count += 1;
    return m.set(b.supplierId, row);
  }, new Map<string, { name: string; owed: number; overdue: number; count: number }>()).values()].sort((a, b) => b.owed - a.owed);
  const openOrders = orders.filter((o) => o.status === "DRAFT" || o.status === "SENT");
  const committed = round2(openOrders.reduce((s, o) => s + o.totalTTC, 0));

  // Customer side
  const unpaid = invoices.filter((i) => i.balance > 0);
  const toCollect = round2(unpaid.reduce((s, i) => s + i.balance, 0));
  const overdueCollect = round2(unpaid.filter((i) => i.dueDate.toISOString().slice(0, 10) < todayIso).reduce((s, i) => s + i.balance, 0));
  const net = round2(toCollect - toPay);


  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Accounting"
        description="Cash and bank, what the company owes its suppliers and what its customers owe it. Amounts include VAT."
        action={
          <>
            <Link href={payHref(here, "PAYMENT")} scroll={false} className={primaryButton}>
              <ArrowUpRight className="size-4" aria-hidden /> Payment voucher
            </Link>
            <Link href={payHref(here, "RECEIPT")} scroll={false} className={secondaryButton}>
              <ArrowDownLeft className="size-4" aria-hidden /> Cash in
            </Link>
            <Link href={payHref(here, "TRANSFER")} scroll={false} className={secondaryButton}>
              <ArrowLeftRight className="size-4" aria-hidden /> Transfer
            </Link>
            {showReceivables && (
              <Link href={payHref(here, "CUSTOMER")} scroll={false} className={secondaryButton}>
                <HandCoins className="size-4" aria-hidden /> Customer payment
              </Link>
            )}
          </>
        }
      />

      <SectionTitle title="Cash & bank">
        <Link href={`${fin}/cash`} className="text-sm text-brand hover:underline">
          Cash book →
        </Link>
      </SectionTitle>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {money.map((a) => (
          <Link key={a.id} href={`${fin}/cash?account=${a.id}`} className={`${cardClass} block p-4 transition hover:border-brand/40`}>
            <p className="text-sm text-muted">
              <span className="font-mono">{a.code}</span> · {a.name}
            </p>
            <p className={`tabular mt-1 text-2xl font-semibold ${a.balance < 0 ? "text-danger" : "text-navy"}`}>{formatMoney(a.balance)}</p>
            <p className="text-xs text-muted">{a.kind === "CASH" ? "Cash box" : "Bank account"}</p>
          </Link>
        ))}
      </div>

      <SectionTitle title="Payables & receivables" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card label="To pay suppliers" value={formatMoney(toPay)} hint={`${openBills.length} open bill${openBills.length === 1 ? "" : "s"}`} />
        <Card label="Overdue to suppliers" value={formatMoney(overduePay)} hint="past the payment due date" tone={overduePay > 0 ? "danger" : "navy"} />
        <Card label="Committed in purchase orders" value={formatMoney(committed)} hint={`${openOrders.length} order${openOrders.length === 1 ? "" : "s"} not received yet`} />
        {showReceivables && (
          <>
            <Card label="To collect from customers" value={formatMoney(toCollect)} hint={`${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}`} />
            <Card label="Overdue from customers" value={formatMoney(overdueCollect)} hint="past the invoice due date" tone={overdueCollect > 0 ? "danger" : "navy"} />
            <Card
              label="Net position"
              value={formatMoney(net)}
              hint={net >= 0 ? "more to collect than to pay" : "more to pay than to collect"}
              tone={net >= 0 ? "success" : "danger"}
            />
          </>
        )}
      </div>

      {/* Supplier bills */}
      <SectionTitle title="Supplier bills">
        <div className="flex gap-3 text-sm">
          <Link href={base} className={billsView === "all" ? "text-brand hover:underline" : "font-semibold text-navy"}>
            Open ({openBills.length})
          </Link>
          <Link href={`${base}?bills=all`} className={billsView === "all" ? "font-semibold text-navy" : "text-brand hover:underline"}>
            All ({withStatus.length})
          </Link>
        </div>
      </SectionTitle>
      <div className={`${cardClass} mt-3 overflow-x-auto`}>
        {shownBills.length === 0 ? (
          <p className="p-8 text-center text-muted">{billsView === "all" ? "No purchases yet." : "Nothing to pay. All supplier bills are settled."}</p>
        ) : (
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">PO</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shownBills.map((b) => (
                <tr key={b.id} className="hover:bg-background/60">
                  <td className="px-4 py-3 font-medium text-navy">{b.supplierName}</td>
                  <td className="px-4 py-3">
                    <Link href={`/c/${slug}/purchases/${b.id}`} className="font-medium text-brand hover:underline">
                      {b.invoiceNumber}
                    </Link>
                    <span className="block text-xs text-muted">{dateFormat.format(b.purchaseDate)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {b.purchaseOrder ? (
                      <Link href={`/c/${slug}/purchase-orders/${b.purchaseOrder.id}`} className="font-mono text-xs text-muted hover:underline">
                        {b.purchaseOrder.number}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{dateFormat.format(b.dueDate)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(b.total)}</td>
                  <td className="px-4 py-3 text-right text-muted">
                    {formatMoney(b.paid)}
                    <ProgressBar value={b.total > 0 ? b.paid / b.total : 1} label="Paid" className="mt-1 min-w-24" />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(b.balance)}</td>
                  <td className="px-4 py-3">
                    <BillStatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.balance > 0 && (
                      <Link href={payHref(here, "SUPPLIER", { bill: b.id })} scroll={false} className={secondaryButtonSm}>
                        Pay (PV)
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        {/* Balance per supplier */}
        <div>
          <SectionTitle title="Owed per supplier" />
          <div className={`${cardClass} mt-3 overflow-x-auto`}>
            {bySupplier.length === 0 ? (
              <p className="p-6 text-center text-muted">Nothing owed.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3 text-right">Open bills</th>
                    <th className="px-4 py-3 text-right">Overdue</th>
                    <th className="px-4 py-3 text-right">Owed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bySupplier.map((s) => (
                    <tr key={s.name}>
                      <td className="px-4 py-3 font-medium text-navy">{s.name}</td>
                      <td className="px-4 py-3 text-right">{s.count}</td>
                      <td className={`px-4 py-3 text-right ${s.overdue > 0 ? "font-medium text-danger" : "text-muted"}`}>{formatMoney(s.overdue)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(s.owed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Committed */}
        <div>
          <SectionTitle title="Purchase orders not received yet" />
          <div className={`${cardClass} mt-3 overflow-x-auto`}>
            {openOrders.length === 0 ? (
              <p className="p-6 text-center text-muted">No open purchase orders.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Expected</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {openOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3">
                        <Link href={`/c/${slug}/purchase-orders/${o.id}`} className="font-mono font-medium text-brand hover:underline">
                          {o.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{o.supplierName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{o.expectedDate ? dateFormat.format(o.expectedDate) : "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(o.totalTTC)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Receivables */}
      {showReceivables && (
        <>
          <SectionTitle title="Unpaid customer invoices">
            <Link href={`/c/${slug}/invoices`} className="text-sm text-brand hover:underline">
              All invoices →
            </Link>
          </SectionTitle>
          <div className={`${cardClass} mt-3 overflow-x-auto`}>
            {unpaid.length === 0 ? (
              <p className="p-6 text-center text-muted">Nothing to collect.</p>
            ) : (
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Balance due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {unpaid.map((i) => {
                    const overdue = i.dueDate.toISOString().slice(0, 10) < todayIso;
                    return (
                      <tr key={i.id}>
                        <td className="px-4 py-3">
                          <Link href={`/c/${slug}/invoices/${i.id}`} className="font-mono font-medium text-brand hover:underline">
                            {i.number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-navy">{i.customerName}</td>
                        <td className={`whitespace-nowrap px-4 py-3 ${overdue ? "font-medium text-danger" : ""}`}>
                          {dateFormat.format(i.dueDate)}
                          {overdue && " · overdue"}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatMoney(i.totalTTC)}
                          <ProgressBar value={i.totalTTC > 0 ? (i.paid + i.credited) / i.totalTTC : 1} label="Settled" className="mt-1 min-w-24" />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{formatMoney(i.balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function AccountingPage({ params, searchParams }: PageProps<"/c/[company]/accounting">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading accounting…</p>}>
      <AccountingContent params={params} searchParams={searchParams as Promise<{ bills?: string }>} />
    </Suspense>
  );
}
