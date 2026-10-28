import { Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  FileText,
  PackagePlus,
  Receipt,
  ShoppingCart,
  Wallet,
  ScanBarcode,
} from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { listBills } from "@/lib/data/accounting";
import { listProductsWithStock } from "@/lib/data/inventory";
import { noticesFor } from "@/lib/data/notices";
import { invoicesWithBalance } from "@/lib/data/ledger";
import { hasPos } from "@/lib/pos";
import { listOffers } from "@/lib/data/sales";
import { formatMoney, round2 } from "@/lib/money";
import { OFFER_STATUSES, type OfferStatus } from "@/lib/offers";
import { COMPANIES, ROLE_LABELS, canAccessModule } from "@/lib/permissions";
import { Badge, StatCard, cardClass, secondaryButton, type Tone } from "@/components/ui";
import { MoneyChart, type MonthPoint } from "./money-chart";

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const OFFER_TONE: Record<OfferStatus, Tone> = { DRAFT: "gray", SENT: "blue", ACCEPTED: "green", REJECTED: "red" };

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`${cardClass} flex flex-col`}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        {action}
      </div>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

const monthKey = (d: Date) => d.toISOString().slice(0, 7);

async function Dashboard({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { user, slug } = await requireCompany(company);
  const can = (m: Parameters<typeof canAccessModule>[2]) => canAccessModule(user, slug, m);
  const base = `/c/${slug}`;

  const [invoices, bills, products, offers, notices] = await Promise.all([
    can("invoices") ? invoicesWithBalance(slug) : [],
    can("accounting") || can("purchases") ? listBills(slug) : [],
    can("inventory") ? listProductsWithStock(slug) : [],
    can("offers") ? listOffers(slug) : [],
    noticesFor(user, slug),
  ]);

  // Last 6 months of money in (non-cancelled invoices) vs money out (purchases).
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1)));
  const activeInvoices = invoices.filter((i) => i.status !== "CANCELLED");
  const series: MonthPoint[] = months.map((m) => ({
    label: monthLabel.format(m),
    invoiced: round2(activeInvoices.filter((i) => monthKey(i.invoiceDate) === monthKey(m)).reduce((s, i) => s + i.totalTTC, 0)),
    purchases: round2(bills.filter((b) => monthKey(b.purchaseDate) === monthKey(m)).reduce((s, b) => s + b.total, 0)),
  }));
  const thisMonth = series[5].invoiced;
  const lastMonth = series[4].invoiced;
  const change = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const toCollect = round2(invoices.reduce((s, i) => s + i.balance, 0));
  const toPay = round2(bills.reduce((s, b) => s + Math.max(0, b.balance), 0));
  const stockValue = round2(products.reduce((s, p) => s + Math.max(0, p.stock) * p.priceHT, 0));
  const openOffers = offers.filter((o) => o.status === "DRAFT" || o.status === "SENT");
  const pipeline = round2(openOffers.reduce((s, o) => s + o.totalTTC, 0));
  const lowStock = products.filter((p) => p.status !== "ok").sort((a, b) => a.stock - b.stock).slice(0, 6);

  const quickActions = [
    can("sales") && hasPos(slug) && { label: "Open the till", href: `${base}/pos`, icon: ScanBarcode },
    can("offers") && { label: "New offer", href: `${base}/offers/new`, icon: FilePlus2 },
    can("purchases") && { label: "New purchase order", href: `${base}/purchase-orders/new`, icon: ClipboardList },
    can("purchases") && { label: "Record a purchase", href: `${base}/purchases/new`, icon: ShoppingCart },
    can("inventory") && { label: "New product", href: `${base}/inventory?new=1`, icon: PackagePlus },
  ].filter(Boolean) as { label: string; href: string; icon: typeof FilePlus2 }[];

  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Beirut" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const showMoney = can("invoices") || can("accounting");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-brand">{COMPANIES[slug].name}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-navy">
            {greeting}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {ROLE_LABELS[user.role]} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(now)}
          </p>
        </div>
        {quickActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <Link key={a.href} href={a.href} className={secondaryButton}>
                <a.icon className="size-4 text-brand" aria-hidden />
                {a.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* KPIs */}
      {/* Fills the row whatever the number of cards the role gets. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        {can("invoices") && (
          <StatCard
            label="Invoiced this month"
            value={formatMoney(thisMonth)}
            icon={Receipt}
            href={`${base}/invoices`}
            hint={
              change === null
                ? "No invoices last month to compare"
                : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs last month (${formatMoney(lastMonth)})`
            }
          />
        )}
        {can("invoices") && <StatCard label="To collect" value={formatMoney(toCollect)} icon={ArrowDownRight} hint="Unpaid customer invoices" href={`${base}/accounting`} />}
        {can("accounting") && <StatCard label="To pay suppliers" value={formatMoney(toPay)} icon={ArrowUpRight} hint="Open supplier bills" href={`${base}/accounting`} />}
        {can("offers") && <StatCard label="Open offers" value={formatMoney(pipeline)} icon={FileText} hint={`${openOffers.length} draft or sent`} href={`${base}/offers`} />}
        {can("inventory") && <StatCard label="Stock value" value={formatMoney(stockValue)} icon={Boxes} hint="At list price excl. VAT" href={`${base}/inventory`} />}
        {!can("invoices") && can("purchases") && (
          <StatCard label="Purchased this month" value={formatMoney(series[5].purchases)} icon={ShoppingCart} hint="Incl. VAT" href={`${base}/purchases`} />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {showMoney && (
          <div className="xl:col-span-2">
            <Panel title="Money in vs money out · last 6 months" action={<Wallet className="size-4 text-muted" aria-hidden />}>
              <MoneyChart data={series} />
            </Panel>
          </div>
        )}
        <div className={showMoney ? "" : "xl:col-span-3"}>
          <Panel title="Needs attention" action={notices.length > 0 ? <Badge tone="red">{notices.length}</Badge> : undefined}>
            {notices.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="size-8 text-success" aria-hidden />
                <p className="mt-2 font-medium text-navy">All clear</p>
                <p className="text-sm text-muted">Nothing overdue or running low.</p>
              </div>
            ) : (
              <ul className="-mx-2 space-y-1">
                {notices.map((n) => (
                  <li key={n.href + n.label}>
                    <Link href={n.href} className="flex gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2">
                      <AlertTriangle
                        className={`mt-0.5 size-4 shrink-0 ${n.tone === "red" ? "text-danger" : n.tone === "amber" ? "text-warning" : "text-brand"}`}
                        aria-hidden
                      />
                      <span>
                        <span className="block text-sm font-medium text-navy">{n.label}</span>
                        <span className="block text-xs text-muted">{n.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {can("offers") && (
          <Panel title="Recent offers" action={<Link href={`${base}/offers`} className="text-xs font-medium text-brand hover:underline">View all</Link>}>
            {offers.length === 0 ? (
              <p className="text-sm text-muted">No offers yet.</p>
            ) : (
              <ul className="-my-2 divide-y divide-border">
                {offers.slice(0, 5).map((o) => (
                  <li key={o.id}>
                    <Link href={`${base}/offers/${o.id}`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-navy">{o.customerName}</span>
                        <span className="block text-xs text-muted">
                          {o.number} · {shortDate.format(o.offerDate)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="tabular text-sm font-semibold text-navy">{formatMoney(o.totalTTC)}</span>
                        <Badge tone={OFFER_TONE[o.status]}>{OFFER_STATUSES[o.status]}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {can("invoices") && (
          <Panel title="Recent invoices" action={<Link href={`${base}/invoices`} className="text-xs font-medium text-brand hover:underline">View all</Link>}>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted">No invoices yet.</p>
            ) : (
              <ul className="-my-2 divide-y divide-border">
                {invoices.slice(0, 5).map((i) => {
                  const overdue = i.status === "ISSUED" && i.dueDate.toISOString().slice(0, 10) < now.toISOString().slice(0, 10);
                  return (
                    <li key={i.id}>
                      <Link href={`${base}/invoices/${i.id}`} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-navy">{i.customerName}</span>
                          <span className="block text-xs text-muted">
                            {i.number} · due {shortDate.format(i.dueDate)}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="tabular text-sm font-semibold text-navy">{formatMoney(i.totalTTC)}</span>
                          <Badge tone={i.status === "PAID" ? "green" : i.status === "CANCELLED" ? "gray" : overdue ? "red" : "amber"}>
                            {i.status === "PAID" ? "Paid" : i.status === "CANCELLED" ? "Cancelled" : overdue ? "Overdue" : "Unpaid"}
                          </Badge>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        {can("inventory") && (
          <Panel title="Running low" action={<Link href={`${base}/inventory?status=low`} className="text-xs font-medium text-brand hover:underline">View stock</Link>}>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted">Every product is above its minimum quantity.</p>
            ) : (
              <ul className="-my-2 divide-y divide-border">
                {lowStock.map((p) => (
                  <li key={p.id}>
                    <Link href={`${base}/inventory/${p.id}`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-navy">{p.name}</span>
                        <span className="block text-xs text-muted">
                          #{p.code} · min {p.minQuantity}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular text-sm font-semibold text-navy">{p.stock}</span>
                        <Badge tone={p.status === "out" ? "red" : "amber"}>{p.status === "out" ? "Out" : "Low"}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-72 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-slate-200/70" />
    </div>
  );
}

export default function DashboardPage({ params }: PageProps<"/c/[company]/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard params={params} />
    </Suspense>
  );
}
