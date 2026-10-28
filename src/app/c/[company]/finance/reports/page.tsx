import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { getLedger, type Ledger } from "@/lib/data/ledger";
import { accountLedger, balanceSheet, profitAndLoss, trialBalance, vatReport, type AccountTotal, type Period } from "@/lib/ledger/reports";
import { formatMoney } from "@/lib/money";
import { COMPANIES, type CompanySlug } from "@/lib/permissions";
import { PageHeader, cardClass, inputClass, tdClass, thClass } from "@/components/ui";
import { Amount, LinkTabs, PeriodFilter, SOURCE_LABELS, periodFrom, sourceHref, type PeriodParams } from "../finance-ui";

type Search = PeriodParams & { r?: string; account?: string };
const REPORTS = [
  { key: "pl", label: "Profit & loss" },
  { key: "bs", label: "Balance sheet" },
  { key: "trial", label: "Trial balance" },
  { key: "vat", label: "VAT" },
  { key: "gl", label: "General ledger" },
] as const;
type ReportKey = (typeof REPORTS)[number]["key"];

function Balanced({ ok, what }: { ok: boolean; what: string }) {
  return ok ? (
    <p className="inline-flex items-center gap-1.5 text-sm text-success">
      <CheckCircle2 className="size-4" aria-hidden /> {what} balanced
    </p>
  ) : (
    <p className="inline-flex items-center gap-1.5 text-sm text-danger">
      <TriangleAlert className="size-4" aria-hidden /> {what} not balanced — check manual entries
    </p>
  );
}

function AccountRows({ rows, glHref }: { rows: AccountTotal[]; glHref: (id: string) => string }) {
  return (
    <>
      {rows.map((a) => (
        <tr key={a.id} className="hover:bg-surface-2/60">
          <td className={`${tdClass} w-24 font-mono text-xs text-muted`}>{a.code}</td>
          <td className={tdClass}>
            <Link href={glHref(a.id)} className="text-navy hover:text-brand hover:underline">
              {a.name}
            </Link>
          </td>
          <td className={`${tdClass} text-right`}>
            <Amount value={a.balance} />
          </td>
        </tr>
      ))}
    </>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <tr className={strong ? "bg-surface-2" : "bg-surface-2/50"}>
      <td className={tdClass} />
      <td className={`${tdClass} font-semibold text-navy`}>{label}</td>
      <td className={`${tdClass} text-right`}>
        <Amount value={value} strong />
      </td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

function ProfitLoss({ ledger, period, glHref }: { ledger: Ledger; period: Period; glHref: (id: string) => string }) {
  const pl = profitAndLoss(ledger, period);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Income">
        <AccountRows rows={pl.income} glHref={glHref} />
        <TotalRow label="Total income" value={pl.totalIncome} />
      </Section>
      <Section title="Expenses">
        <AccountRows rows={pl.expenses} glHref={glHref} />
        <TotalRow label="Total expenses" value={pl.totalExpenses} />
      </Section>
      <div className={`${cardClass} flex items-center justify-between p-5 lg:col-span-2 ${pl.net >= 0 ? "bg-green-50/60" : "bg-red-50/60"}`}>
        <p className="font-semibold text-navy">{pl.net >= 0 ? "Net profit" : "Net loss"} for the period</p>
        <p className={`tabular text-2xl font-semibold ${pl.net >= 0 ? "text-success" : "text-danger"}`}>{formatMoney(pl.net)}</p>
      </div>
      <p className="text-xs text-muted lg:col-span-2">
        Purchases of goods are expensed when bought (periodic inventory). Amounts exclude VAT.
      </p>
    </div>
  );
}

function BalanceSheet({ ledger, asOf, glHref }: { ledger: Ledger; asOf: Date; glHref: (id: string) => string }) {
  const bs = balanceSheet(ledger, asOf);
  return (
    <div className="space-y-4">
      <Balanced ok={bs.balanced} what="Assets = liabilities + equity:" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Assets">
          <AccountRows rows={bs.assets} glHref={glHref} />
          <TotalRow label="Total assets" value={bs.totalAssets} strong />
        </Section>
        <div className="space-y-6">
          <Section title="Liabilities">
            <AccountRows rows={bs.liabilities} glHref={glHref} />
            <TotalRow label="Total liabilities" value={bs.totalLiabilities} />
          </Section>
          <Section title="Equity">
            <AccountRows rows={bs.equity} glHref={glHref} />
            <tr>
              <td className={tdClass} />
              <td className={`${tdClass} text-navy`}>Result not yet closed (profit / loss)</td>
              <td className={`${tdClass} text-right`}>
                <Amount value={bs.result} />
              </td>
            </tr>
            <TotalRow label="Total equity" value={bs.totalEquity} />
            <TotalRow label="Liabilities + equity" value={bs.totalLiabilities + bs.totalEquity} strong />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Trial({ ledger, period, glHref }: { ledger: Ledger; period: Period; glHref: (id: string) => string }) {
  const tb = trialBalance(ledger, period);
  return (
    <div className="space-y-4">
      <Balanced ok={tb.balanced} what="Debits = credits:" />
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr>
              <th className={thClass}>Code</th>
              <th className={thClass}>Account</th>
              <th className={`${thClass} text-right`}>Debit</th>
              <th className={`${thClass} text-right`}>Credit</th>
              <th className={`${thClass} text-right`}>Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tb.rows.map((a) => (
              <tr key={a.id} className="hover:bg-surface-2/60">
                <td className={`${tdClass} font-mono text-xs text-muted`}>{a.code}</td>
                <td className={tdClass}>
                  <Link href={glHref(a.id)} className="text-navy hover:text-brand hover:underline">
                    {a.name}
                  </Link>
                </td>
                <td className={`${tdClass} text-right`}>
                  <Amount value={a.debit} blankZero />
                </td>
                <td className={`${tdClass} text-right`}>
                  <Amount value={a.credit} blankZero />
                </td>
                <td className={`${tdClass} text-right`}>
                  <Amount value={a.balance} strong />
                </td>
              </tr>
            ))}
            <tr className="bg-surface-2">
              <td className={tdClass} />
              <td className={`${tdClass} font-semibold text-navy`}>Totals</td>
              <td className={`${tdClass} text-right`}>
                <Amount value={tb.debit} strong />
              </td>
              <td className={`${tdClass} text-right`}>
                <Amount value={tb.credit} strong />
              </td>
              <td className={tdClass} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Vat({ ledger, period }: { ledger: Ledger; period: Period }) {
  const v = vatReport(ledger, period);
  const rows: [string, number, string][] = [
    ["Sales excl. VAT", v.sales, "Net of credit notes"],
    ["VAT collected (output)", v.collected, "Account 4427"],
    ["Purchases excl. VAT", v.purchases, "Goods bought"],
    ["VAT recoverable (input)", v.recoverable, "Account 4426 — purchases and expense vouchers"],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {rows.map(([label, value, hint]) => (
              <tr key={label}>
                <td className={tdClass}>
                  <span className="font-medium text-navy">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </td>
                <td className={`${tdClass} text-right`}>
                  <Amount value={value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`${cardClass} p-5 ${v.net >= 0 ? "" : "bg-green-50/60"}`}>
        <p className="text-sm text-muted">{v.net >= 0 ? "VAT payable for the period" : "VAT credit to carry forward"}</p>
        <p className="tabular mt-1 text-3xl font-semibold text-navy">{formatMoney(Math.abs(v.net))}</p>
        <p className="mt-2 text-xs text-muted">Collected − recoverable. Pay it with a payment voucher charged to 4427 VAT collected.</p>
      </div>
    </div>
  );
}

function GeneralLedger({ ledger, period, accountId, slug, base, fromStr, toStr }: { ledger: Ledger; period: Period; accountId?: string; slug: CompanySlug; base: string; fromStr: string; toStr: string }) {
  const accounts = ledger.accounts;
  const selected = accounts.find((a) => a.id === accountId) ?? accounts.find((a) => a.kind === "CASH") ?? accounts[0];
  const gl = selected ? accountLedger(ledger, selected.id, period) : null;
  return (
    <div className="space-y-4">
      <form action={base} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="r" value="gl" />
        <input type="hidden" name="from" value={fromStr} />
        <input type="hidden" name="to" value={toStr} />
        <label className="text-xs font-medium text-muted">
          Account
          <select name="account" defaultValue={selected?.id} className={`${inputClass} mt-1 h-9 w-80`}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
                {a.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-slate-700 hover:bg-surface-2">
          Show
        </button>
      </form>
      {gl && (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Date</th>
                <th className={thClass}>Entry</th>
                <th className={thClass}>Description</th>
                <th className={`${thClass} text-right`}>Debit</th>
                <th className={`${thClass} text-right`}>Credit</th>
                <th className={`${thClass} text-right`}>Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="bg-surface-2/50">
                <td className={tdClass} colSpan={5}>
                  <span className="font-medium text-navy">Opening balance</span>
                </td>
                <td className={`${tdClass} text-right`}>
                  <Amount value={gl.opening} strong />
                </td>
              </tr>
              {gl.moves.map((m, i) => {
                const href = sourceHref(slug, m.sourceType, m.sourceId);
                return (
                  <tr key={`${m.entryId}-${i}`} className="hover:bg-surface-2/60">
                    <td className={`${tdClass} whitespace-nowrap`}>{dayFormat.format(m.date)}</td>
                    <td className={tdClass}>
                      <span className="block font-mono text-xs text-navy">{m.number}</span>
                      <span className="text-xs text-muted">{SOURCE_LABELS[m.sourceType] ?? m.sourceType}</span>
                    </td>
                    <td className={tdClass}>
                      {href ? (
                        <Link href={href} className="text-navy hover:text-brand hover:underline">
                          {m.description ?? m.memo}
                        </Link>
                      ) : (
                        (m.description ?? m.memo)
                      )}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Amount value={m.debit} blankZero />
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Amount value={m.credit} blankZero />
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Amount value={m.balance} strong />
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-surface-2">
                <td className={tdClass} colSpan={3}>
                  <span className="font-semibold text-navy">Closing balance</span>
                </td>
                <td className={`${tdClass} text-right`}>
                  <Amount value={gl.debit} strong />
                </td>
                <td className={`${tdClass} text-right`}>
                  <Amount value={gl.credit} strong />
                </td>
                <td className={`${tdClass} text-right`}>
                  <Amount value={gl.closing} strong />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function ReportsContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "accounting");
  const base = `/c/${slug}/finance/reports`;
  const report: ReportKey = REPORTS.some((r) => r.key === search.r) ? (search.r as ReportKey) : "pl";
  const { fromStr, toStr, period } = periodFrom(search);
  const ledger = await getLedger(slug);
  const glHref = (id: string) => `${base}?r=gl&account=${id}&from=${fromStr}&to=${toStr}`;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Finance`}
        title="Financial reports"
        description="Computed live from the general ledger: every invoice, purchase, payment, voucher and journal entry. Amounts in USD."
      />
      <div className="mt-6">
        <LinkTabs active={report} tabs={REPORTS.map((r) => ({ key: r.key, label: r.label, href: `${base}?r=${r.key}&from=${fromStr}&to=${toStr}` }))} />
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <PeriodFilter action={base} from={fromStr} to={toStr} keep={{ r: report, account: search.account }} />
        {report === "bs" && <p className="text-sm text-muted">Balance sheet at {dayFormat.format(period.to ?? new Date())}</p>}
      </div>
      <div className="mt-6">
        {report === "pl" && <ProfitLoss ledger={ledger} period={period} glHref={glHref} />}
        {report === "bs" && <BalanceSheet ledger={ledger} asOf={period.to ?? new Date()} glHref={glHref} />}
        {report === "trial" && <Trial ledger={ledger} period={period} glHref={glHref} />}
        {report === "vat" && <Vat ledger={ledger} period={period} />}
        {report === "gl" && <GeneralLedger ledger={ledger} period={period} accountId={search.account} slug={slug} base={base} fromStr={fromStr} toStr={toStr} />}
      </div>
    </>
  );
}

export default function ReportsPage({ params, searchParams }: PageProps<"/c/[company]/finance/reports">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading reports…</p>}>
      <ReportsContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
