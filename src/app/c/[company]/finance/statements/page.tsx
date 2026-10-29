import { Suspense } from "react";
import { SendButton } from "@/components/send-button";
import Link from "next/link";
import { FileDown, ScrollText } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { loadStatements, type PartnerType } from "@/lib/data/statements";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { EmptyState, PageHeader, cardClass, inputClass, primaryButton, secondaryButton, tdClass, thClass } from "@/components/ui";
import { Amount, LinkTabs, PeriodFilter, SOURCE_LABELS, periodFrom, sourceHref, type PeriodParams } from "../finance-ui";

type Search = PeriodParams & { type?: string; party?: string };

async function StatementsContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "accounting");
  const base = `/c/${slug}/finance/statements`;
  const type: PartnerType = search.type === "supplier" ? "SUPPLIER" : "CUSTOMER";
  const typeParam = type === "SUPPLIER" ? "supplier" : "customer";
  const { fromStr, toStr, period } = periodFrom(search);
  const { balances, options, partner, result } = await loadStatements(slug, type, search.party, period);
  const customer = type === "CUSTOMER";
  const open = balances.filter((b) => Math.abs(b.balance) >= 0.005);
  const total = round2(open.reduce((s, b) => s + b.balance, 0));
  const qs = (party: string) => `type=${typeParam}&party=${encodeURIComponent(party)}&from=${fromStr}&to=${toStr}`;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Finance`}
        title="Statements of account"
        description="Every invoice, bill, payment and credit for one customer or supplier, with the running balance. Export as PDF to send it."
        action={
          partner && (
            <>
              {partner.type === "CUSTOMER" && partner.id && <SendButton companySlug={slug} kind="statement" id={partner.id} />}
              <a href={`${base}/pdf?${qs(search.party!)}`} target="_blank" rel="noopener" className={primaryButton}>
                <FileDown className="size-4" aria-hidden /> Open PDF
              </a>
              <a href={`${base}/pdf?${qs(search.party!)}&download=1`} className={secondaryButton}>
                Download PDF
              </a>
            </>
          )
        }
      />

      <div className="mt-6">
        <LinkTabs
          active={typeParam}
          tabs={[
            { key: "customer", label: "Customers", href: `${base}?type=customer&from=${fromStr}&to=${toStr}` },
            { key: "supplier", label: "Suppliers", href: `${base}?type=supplier&from=${fromStr}&to=${toStr}` },
          ]}
        />
      </div>

      <div className="mt-4">
        <PeriodFilter action={base} from={fromStr} to={toStr} keep={{ type: typeParam }}>
          <label className="text-xs font-medium text-muted">
            {customer ? "Customer" : "Supplier"}
            <select name="party" defaultValue={search.party ?? ""} className={`${inputClass} mt-1 h-9 w-72`}>
              <option value="">All — balances overview</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </PeriodFilter>
      </div>

      {partner && result ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {(
              [
                ["Opening balance", result.opening],
                [customer ? "Charged" : "Paid", result.debit],
                [customer ? "Paid & credited" : "Billed", result.credit],
                [customer ? "Balance due" : "Balance owed", result.closing],
              ] as [string, number][]
            ).map(([label, value], i) => (
              <div key={label} className={`${cardClass} p-4 ${i === 3 ? "bg-surface-2" : ""}`}>
                <p className="text-sm text-muted">{label}</p>
                <p className={`tabular mt-1 text-xl font-semibold ${i === 3 && value > 0 ? "text-navy" : "text-slate-700"}`}>{formatMoney(value)}</p>
              </div>
            ))}
          </div>
          <div className={`${cardClass} mt-4 overflow-x-auto`}>
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Entry</th>
                  <th className={thClass}>Description</th>
                  <th className={`${thClass} text-right`}>{customer ? "Debit" : "Debit (paid)"}</th>
                  <th className={`${thClass} text-right`}>{customer ? "Credit" : "Credit (billed)"}</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="bg-surface-2/50">
                  <td className={tdClass} colSpan={5}>
                    <span className="font-medium text-navy">Opening balance {fromStr && `at ${dayFormat.format(new Date(`${fromStr}T00:00:00Z`))}`}</span>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Amount value={result.opening} strong />
                  </td>
                </tr>
                {result.moves.map((m, i) => {
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
                {result.moves.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted">
                      No movements in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="mt-6 flex items-end justify-between">
            <h2 className="text-lg font-semibold text-navy">{customer ? "What customers owe" : "What we owe suppliers"}</h2>
            <p className="text-sm text-muted">
              Total <span className="tabular font-semibold text-navy">{formatMoney(total)}</span>
            </p>
          </div>
          <div className={`${cardClass} mt-3 overflow-x-auto`}>
            {open.length === 0 ? (
              <EmptyState icon={ScrollText} title="All accounts are settled" description={`No ${customer ? "customer" : "supplier"} has an open balance.`} />
            ) : (
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr>
                    <th className={thClass}>{customer ? "Customer" : "Supplier"}</th>
                    <th className={`${thClass} text-right`}>{customer ? "Charged" : "Paid"}</th>
                    <th className={`${thClass} text-right`}>{customer ? "Paid & credited" : "Billed"}</th>
                    <th className={`${thClass} text-right`}>Balance</th>
                    <th className={thClass} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {open.map((b) => (
                    <tr key={b.key} className="hover:bg-surface-2/60">
                      <td className={`${tdClass} font-medium text-navy`}>
                        {b.name}
                        {!b.id && customer && <span className="ml-1 text-xs font-normal text-muted">(not saved)</span>}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Amount value={b.debit} />
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Amount value={b.credit} />
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Amount value={b.balance} strong />
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Link href={`${base}?${qs(b.key)}`} className="text-sm text-brand hover:underline">
                          Statement →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function StatementsPage({ params, searchParams }: PageProps<"/c/[company]/finance/statements">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading statements…</p>}>
      <StatementsContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
