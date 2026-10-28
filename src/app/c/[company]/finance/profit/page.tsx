import { Suspense } from "react";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import type { ProfitFigures } from "@/lib/costing";
import { profitReport } from "@/lib/data/profit";
import { formatMoney } from "@/lib/money";
import { COMPANIES, canAccessModule } from "@/lib/permissions";
import { PageHeader, StatCard, cardClass, tdClass, thClass } from "@/components/ui";
import { LinkTabs, PeriodFilter, periodFrom, type PeriodParams } from "../finance-ui";

type Search = PeriodParams & { view?: string };
const VIEWS = [
  { key: "jobs", label: "Job cards" },
  { key: "sales", label: "Counter sales" },
  { key: "offers", label: "Offers" },
  { key: "products", label: "Products" },
] as const;

function Figures({ f }: { f: ProfitFigures }) {
  return (
    <>
      <td className={`${tdClass} tabular text-right`}>{formatMoney(f.revenue)}</td>
      <td className={`${tdClass} tabular text-right text-muted`}>{formatMoney(f.cost)}</td>
      <td className={`${tdClass} tabular text-right font-semibold ${f.profit < 0 ? "text-danger" : "text-navy"}`}>{formatMoney(f.profit)}</td>
      <td className={`${tdClass} tabular text-right ${f.margin !== null && f.margin < 15 ? "text-amber-700" : "text-muted"}`}>{f.margin === null ? "—" : `${f.margin}%`}</td>
    </>
  );
}

async function ProfitContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "accounting");
  const base = `/c/${slug}/finance/profit`;
  const { fromStr, toStr, period } = periodFrom(search);
  const view = VIEWS.some((v) => v.key === search.view) ? (search.view as (typeof VIEWS)[number]["key"]) : "jobs";
  const r = await profitReport(slug, period);
  const current = r[view];
  const canSettings = canAccessModule(user, slug, "settings");

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Finance`}
        title="Profit"
        description="Revenue excl. VAT against real cost: parts at average cost (purchase price after discount + freight, customs…), workshop labour at the hourly cost you set."
      />
      {r.labourCostPerHour === 0 && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The workshop labour cost per hour is not set, so labour counts as free.{" "}
          {canSettings && (
            <Link href={`/c/${slug}/settings`} className="font-medium underline">
              Set it in Company details
            </Link>
          )}
        </p>
      )}
      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        {VIEWS.filter((v) => v.key !== "products").map((v) => (
          <StatCard key={v.key} label={`${v.label}: profit`} value={formatMoney(r[v.key].total.profit)} hint={r[v.key].total.margin === null ? "no sales" : `${r[v.key].total.margin}% margin on ${formatMoney(r[v.key].total.revenue)}`} />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <LinkTabs active={view} tabs={VIEWS.map((v) => ({ key: v.key, label: v.label, href: `${base}?view=${v.key}&from=${fromStr}&to=${toStr}` }))} />
        <PeriodFilter action={base} from={fromStr} to={toStr} keep={{ view }} />
      </div>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr>
              {view === "products" ? (
                <>
                  <th className={thClass}>Product</th>
                  <th className={`${thClass} text-right`}>Units</th>
                </>
              ) : (
                <>
                  <th className={thClass}>Document</th>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Customer</th>
                </>
              )}
              <th className={`${thClass} text-right`}>Revenue</th>
              <th className={`${thClass} text-right`}>Cost</th>
              <th className={`${thClass} text-right`}>Profit</th>
              <th className={`${thClass} text-right`}>Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {view === "products"
              ? r.products.rows.map((p) => (
                  <tr key={p.id}>
                    <td className={tdClass}>
                      {p.code && <span className="font-mono text-xs text-muted">{p.code} </span>}
                      <span className="font-medium text-navy">{p.name}</span>
                    </td>
                    <td className={`${tdClass} tabular text-right`}>{p.units}</td>
                    <Figures f={p} />
                  </tr>
                ))
              : r[view].rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-2/60">
                    <td className={tdClass}>
                      <Link href={row.href} className="font-mono text-xs font-medium text-brand hover:underline">
                        {row.label}
                      </Link>
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{dayFormat.format(row.date)}</td>
                    <td className={tdClass}>{row.who}</td>
                    <Figures f={row} />
                  </tr>
                ))}
            {current.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  Nothing in this period.
                </td>
              </tr>
            )}
            {current.rows.length > 0 && (
              <tr className="bg-surface-2 font-semibold text-navy">
                <td className={tdClass} colSpan={view === "products" ? 2 : 3}>
                  Total
                </td>
                <Figures f={current.total} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Job cards started from an offer are counted under Offers. Products never bought have no known cost, so their profit shows in full.
      </p>
    </>
  );
}

export default function ProfitPage({ params, searchParams }: PageProps<"/c/[company]/finance/profit">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading profit…</p>}>
      <ProfitContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
