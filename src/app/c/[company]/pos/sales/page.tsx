import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, ReceiptText, ScanBarcode } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { businessToday, dayFormat, parseDay, parseDayEnd } from "@/lib/dates";
import { listSales, salesSummary } from "@/lib/data/pos";
import { formatMoney } from "@/lib/money";
import { SALE_STATUS, formatLbp, hasPos } from "@/lib/pos";
import { COMPANIES } from "@/lib/permissions";
import { Badge, ButtonLink, EmptyState, PageHeader, SearchBar, StatCard, cardClass, tdClass, thClass } from "@/components/ui";
import { PeriodFilter } from "../../finance/finance-ui";

type Search = { q?: string; from?: string; to?: string; cashier?: string };
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" });

async function SalesContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "sales");
  if (!hasPos(slug)) notFound();
  const base = `/c/${slug}/pos/sales`;
  const today = businessToday();
  const fromStr = search.from ?? today;
  const toStr = search.to ?? today;
  const from = parseDay(fromStr);
  const to = parseDayEnd(toStr);
  const all = await listSales(slug);
  // Cashiers see their own sales; managers and accountants see everyone's.
  const mine = user.role === "CASHIER" ? all.filter((s) => s.cashierId === user.id) : all;
  const inPeriod = (d: Date) => (!from || d >= from) && (!to || d <= to);
  const sales = mine.filter((s) => inPeriod(s.saleDate));
  const refunds = mine.flatMap((s) => s.refunds.filter((r) => inPeriod(r.date)).map((r) => ({ ...r, sale: s })));
  const sum = salesSummary(sales, refunds);
  const needle = (search.q ?? "").trim().toLowerCase();
  const shown = sales.filter((s) => !needle || s.number.toLowerCase().includes(needle) || s.customerName.toLowerCase().includes(needle) || s.lines.some((l) => l.name.toLowerCase().includes(needle) || l.code.includes(needle)));
  const period = fromStr === toStr ? dayFormat.format(from ?? new Date()) : `${dayFormat.format(from ?? new Date())} – ${dayFormat.format(to ?? new Date())}`;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Retail`}
        title="Counter sales"
        description={`Sales report for ${period}: takings by payment method, cashier and product.`}
        action={<ButtonLink icon={ScanBarcode} href={`/c/${slug}/pos`}>Open the till</ButtonLink>}
      />
      <div className="mt-6">
        <PeriodFilter action={base} from={fromStr} to={toStr} keep={{ q: search.q }} />
      </div>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        <StatCard label="Net sales" value={formatMoney(sum.net)} hint={`${sum.count} sale${sum.count === 1 ? "" : "s"}${sum.refunded ? ` · ${formatMoney(sum.refunded)} refunded` : ""}`} icon={ReceiptText} />
        <StatCard label="Cash USD" value={formatMoney(sum.methods.usd)} hint="kept after change and refunds" />
        <StatCard label="Cash LBP" value={formatLbp(sum.methods.lbp)} hint="kept after change and refunds" />
        <StatCard label="Card" value={formatMoney(sum.methods.card)} />
        <StatCard label="VAT collected" value={formatMoney(sum.vat)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div>
          <SearchBar action={base} defaultValue={search.q} placeholder="Search by sale number, customer or product" keep={{ from: fromStr, to: toStr }} />
          <div className={`${cardClass} mt-4 overflow-x-auto`}>
            {shown.length === 0 ? (
              <EmptyState icon={ReceiptText} title="No sales in this period" />
            ) : (
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr>
                    <th className={thClass}>Sale</th>
                    <th className={thClass}>Time</th>
                    <th className={thClass}>Customer</th>
                    <th className={thClass}>Items</th>
                    <th className={thClass}>Paid with</th>
                    <th className={`${thClass} text-right`}>Total</th>
                    <th className={thClass} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-2/60">
                      <td className={tdClass}>
                        <Link href={`${base}/${s.id}`} className="font-mono text-xs font-medium text-brand hover:underline">
                          {s.number}
                        </Link>
                        {s.status !== "COMPLETED" && (
                          <span className="ml-2">
                            <Badge tone={s.status === "REFUNDED" ? "red" : "amber"}>{SALE_STATUS[s.status]}</Badge>
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-muted`}>
                        {fromStr === toStr ? time.format(s.createdAt) : `${dayFormat.format(s.saleDate)} ${time.format(s.createdAt)}`}
                        <span className="block text-xs">{s.cashierName}</span>
                      </td>
                      <td className={tdClass}>{s.customerName}</td>
                      <td className={`${tdClass} text-muted`}>{s.lines.reduce((n, l) => n + l.quantity, 0)}</td>
                      <td className={`${tdClass} text-xs text-muted`}>
                        {[s.paidUsd - s.changeUsd > 0 && "USD", s.paidLbp - s.changeLbp > 0 && "LBP", s.paidCard > 0 && "Card"].filter(Boolean).join(" + ") || "—"}
                      </td>
                      <td className={`${tdClass} tabular text-right font-semibold`}>{formatMoney(s.totalTTC)}</td>
                      <td className={`${tdClass} text-right`}>
                        <a
                          href={`${base}/${s.id}/receipt?print=1`}
                          target="_blank"
                          rel="noopener"
                          title="Print receipt"
                          aria-label="Print receipt"
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy"
                        >
                          <Printer className="size-4" aria-hidden />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          {user.role !== "CASHIER" && (
            <section className={`${cardClass} overflow-hidden`}>
              <h2 className="border-b border-border px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted">By cashier</h2>
              {sum.cashiers.length === 0 ? (
                <p className="p-4 text-sm text-muted">No sales.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {sum.cashiers.map((c) => (
                    <li key={c.name} className="flex justify-between px-4 py-2.5">
                      <span className="text-navy">
                        {c.name} <span className="text-xs text-muted">· {c.count}</span>
                      </span>
                      <span className="tabular font-medium">{formatMoney(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section className={`${cardClass} overflow-hidden`}>
            <h2 className="border-b border-border px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted">Best sellers</h2>
            {sum.products.length === 0 ? (
              <p className="p-4 text-sm text-muted">No products sold.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {sum.products.slice(0, 10).map((p) => (
                  <li key={p.code} className="flex justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0 truncate text-navy">
                      <span className="tabular font-semibold">{p.quantity}×</span> {p.name}
                    </span>
                    <span className="tabular text-muted">{formatMoney(p.amountHT)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export default function PosSalesPage({ params, searchParams }: PageProps<"/c/[company]/pos/sales">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading sales…</p>}>
      <SalesContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
