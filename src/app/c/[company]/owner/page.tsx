import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { ownerSummary, type OwnerSummary } from "@/lib/data/owner";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES, allowedCompanies } from "@/lib/permissions";
import { PageHeader, StatCard, cardClass } from "@/components/ui";
import { MoneyChart } from "../dashboard/money-chart";

function Change({ now, before }: { now: number; before: number }) {
  if (before <= 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-success" : "text-danger"}`}>
      <Icon className="size-3.5" aria-hidden /> {Math.abs(pct)}% vs last month
    </span>
  );
}

function Row({ label, value, tone, href }: { label: string; value: string; tone?: "danger" | "muted"; href?: string }) {
  const v = <span className={`tabular font-semibold ${tone === "danger" ? "text-danger" : tone === "muted" ? "text-muted" : "text-navy"}`}>{value}</span>;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {href ? (
        <Link href={href} className="hover:underline">
          {v}
        </Link>
      ) : (
        v
      )}
    </div>
  );
}

function CompanyPanel({ s }: { s: OwnerSummary }) {
  const base = `/c/${s.slug}`;
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-navy">{COMPANIES[s.slug].name}</h2>
      <div className={`${cardClass} p-5`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm text-muted">Sales this month (excl. VAT)</p>
            <p className="tabular text-2xl font-semibold text-navy">{formatMoney(s.salesThisMonth)}</p>
          </div>
          <Change now={s.salesThisMonth} before={s.salesLastMonth} />
        </div>
        <div className="mt-4">
          <MoneyChart data={s.series} labels={{ invoiced: "Sales", purchases: "Expenses", empty: "No sales or expenses in the last 12 months" }} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${cardClass} divide-y divide-border px-5 py-3`}>
          <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted">This year</p>
          <Row label="Sales" value={formatMoney(s.salesYear)} href={`${base}/finance/reports?r=pl`} />
          <Row label="Net profit (books)" value={formatMoney(s.profitYear)} tone={s.profitYear < 0 ? "danger" : undefined} href={`${base}/finance/reports?r=pl`} />
          <Row label="Gross profit on jobs & sales" value={formatMoney(s.grossProfitYear)} href={`${base}/finance/profit`} />
          <Row label="Offers waiting for an answer" value={formatMoney(s.pipeline)} tone="muted" href={`${base}/offers`} />
        </div>
        <div className={`${cardClass} divide-y divide-border px-5 py-3`}>
          <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted">Money</p>
          <Row label="Cash & bank" value={formatMoney(s.cash)} tone={s.cash < 0 ? "danger" : undefined} href={`${base}/finance/cash`} />
          <Row label="Customers owe" value={formatMoney(s.toCollect)} href={`${base}/finance/statements`} />
          <Row label="…of which overdue" value={formatMoney(s.overdue)} tone={s.overdue > 0 ? "danger" : "muted"} />
          <Row label="We owe suppliers" value={formatMoney(s.toPay)} href={`${base}/accounting`} />
          <Row label="Cheques to collect / to be paid" value={`${formatMoney(s.chequesIn)} / ${formatMoney(s.chequesOut)}`} tone="muted" href={`${base}/finance/cheques`} />
        </div>
        <div className={`${cardClass} divide-y divide-border px-5 py-3`}>
          <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted">Operations</p>
          <Row label="Stock value at cost" value={formatMoney(s.stockValue)} href={`${base}/inventory`} />
          <Row label="Open job cards" value={String(s.openJobs)} href={`${base}/workshop`} />
          <Row label="Appointments next 7 days" value={String(s.appointmentsWeek)} href={`${base}/appointments`} />
          <Row label="Cheques due within 7 days" value={String(s.chequesDueWeek)} tone={s.chequesDueWeek ? "danger" : "muted"} href={`${base}/finance/cheques`} />
        </div>
        <div className={`${cardClass} px-5 py-3`}>
          <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted">Best customers this year</p>
          {s.topCustomers.length === 0 ? (
            <p className="py-2 text-sm text-muted">No sales yet.</p>
          ) : (
            s.topCustomers.map((c, i) => <Row key={c.name} label={`${i + 1}. ${c.name}`} value={formatMoney(c.total)} />)
          )}
          {s.topProducts.length > 0 && (
            <>
              <p className="pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">Most profitable products</p>
              {s.topProducts.map((p) => (
                <Row key={p.name} label={`${p.name} · ${p.units} sold`} value={formatMoney(p.profit)} />
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

async function OwnerContent({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { user, slug } = await requireModule(company, "owner");
  // The admin sees both companies side by side; a manager sees their own.
  const slugs = user.role === "ADMIN" ? allowedCompanies(user) : [slug];
  const summaries = await Promise.all(slugs.map((s) => ownerSummary(s)));
  const sum = (k: keyof Pick<OwnerSummary, "salesThisMonth" | "salesLastMonth" | "profitYear" | "cash" | "toCollect" | "toPay">) => round2(summaries.reduce((t, s) => t + s[k], 0));

  return (
    <>
      <PageHeader
        eyebrow={slugs.length > 1 ? "Xpert Marine & Eliche Radice" : COMPANIES[slug].name}
        title="Owner dashboard"
        description="The business at a glance: sales, profit, cash and who owes what. Figures come from the books, so they match the reports."
      />
      {slugs.length > 1 && (
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
          <StatCard label="Group sales this month" value={formatMoney(sum("salesThisMonth"))} hint={`last month ${formatMoney(sum("salesLastMonth"))}`} />
          <StatCard label="Group net profit this year" value={formatMoney(sum("profitYear"))} tone={sum("profitYear") < 0 ? "danger" : "success"} />
          <StatCard label="Cash & bank" value={formatMoney(sum("cash"))} />
          <StatCard label="Customers owe" value={formatMoney(sum("toCollect"))} />
          <StatCard label="We owe suppliers" value={formatMoney(sum("toPay"))} />
        </div>
      )}
      <div className={`mt-8 grid gap-8 ${slugs.length > 1 ? "2xl:grid-cols-2" : ""}`}>
        {summaries.map((s) => (
          <CompanyPanel key={s.slug} s={s} />
        ))}
      </div>
    </>
  );
}

export default function OwnerPage({ params }: PageProps<"/c/[company]/owner">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the owner dashboard…</p>}>
      <OwnerContent params={params} />
    </Suspense>
  );
}
