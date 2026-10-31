import { Suspense } from "react";
import Link from "next/link";
import { payHref } from "@/lib/url";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Wallet } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { getLedger } from "@/lib/data/ledger";
import { accountLedger, moneyBalances } from "@/lib/ledger/reports";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { EmptyState, PageHeader, cardClass, primaryButton, secondaryButton, tdClass, thClass } from "@/components/ui";
import { Amount, PeriodFilter, SOURCE_LABELS, periodFrom, sourceHref, type PeriodParams } from "../finance-ui";

type Search = PeriodParams & { account?: string };

async function CashContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "accounting");
  const base = `/c/${slug}/finance/cash`;
  const ledger = await getLedger(slug);
  const accounts = moneyBalances(ledger).filter((a) => a.active || a.balance !== 0);
  const total = round2(accounts.reduce((s, a) => s + a.balance, 0));
  const selected = accounts.find((a) => a.id === search.account) ?? accounts[0];
  const { fromStr, toStr, period } = periodFrom(search);
  const book = selected ? accountLedger(ledger, selected.id, period) : null;
  const fin = `/c/${slug}/finance`;
  const here = `${fin}/cash`;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Money`}
        title="Cash & bank"
        description="Balance of every cash box and bank account, and the cash book: every movement in and out, with a running balance."
        action={
          <>
            <Link href={payHref(here, "PAYMENT")} scroll={false} className={primaryButton}>
              <ArrowUpRight className="size-4" aria-hidden /> Pay (PV)
            </Link>
            <Link href={payHref(here, "RECEIPT")} scroll={false} className={secondaryButton}>
              <ArrowDownLeft className="size-4" aria-hidden /> Cash in (RV)
            </Link>
            <Link href={payHref(here, "TRANSFER")} scroll={false} className={secondaryButton}>
              <ArrowLeftRight className="size-4" aria-hidden /> Transfer
            </Link>
          </>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {accounts.map((a) => (
          <Link
            key={a.id}
            href={`${base}?account=${a.id}&from=${fromStr}&to=${toStr}`}
            aria-current={a.id === selected?.id ? "true" : undefined}
            className={`${cardClass} block p-4 transition hover:border-brand/40 ${a.id === selected?.id ? "border-brand ring-2 ring-brand/15" : ""}`}
          >
            <p className="text-sm text-muted">
              <span className="font-mono">{a.code}</span> · {a.name}
            </p>
            <p className={`tabular mt-1 text-2xl font-semibold ${a.balance < 0 ? "text-danger" : "text-navy"}`}>{formatMoney(a.balance)}</p>
            <p className="text-xs text-muted">{a.kind === "CASH" ? "Cash box" : "Bank account"}</p>
          </Link>
        ))}
        <div className={`${cardClass} bg-surface-2 p-4`}>
          <p className="text-sm text-muted">Total cash & bank</p>
          <p className={`tabular mt-1 text-2xl font-semibold ${total < 0 ? "text-danger" : "text-navy"}`}>{formatMoney(total)}</p>
          <p className="text-xs text-muted">
            <Link href={`${fin}/accounts`} className="text-brand hover:underline">
              Add a cash box or bank account
            </Link>
          </p>
        </div>
      </div>

      {selected && book ? (
        <>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-navy">
                Cash book · {selected.code} {selected.name}
              </h2>
              <p className="text-sm text-muted">
                Opening {formatMoney(book.opening)} · in {formatMoney(book.debit)} · out {formatMoney(book.credit)} · closing{" "}
                <span className="font-semibold text-navy">{formatMoney(book.closing)}</span>
              </p>
            </div>
            <PeriodFilter action={base} from={fromStr} to={toStr} keep={{ account: selected.id }} />
          </div>
          <div className={`${cardClass} mt-4 overflow-x-auto`}>
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Entry</th>
                  <th className={thClass}>Description</th>
                  <th className={`${thClass} text-right`}>In</th>
                  <th className={`${thClass} text-right`}>Out</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="bg-surface-2/50">
                  <td className={tdClass} colSpan={5}>
                    <span className="font-medium text-navy">Opening balance</span>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Amount value={book.opening} strong />
                  </td>
                </tr>
                {book.moves.map((m, i) => {
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
                      <td className={`${tdClass} text-right text-success`}>
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
                {book.moves.length === 0 && (
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
        <div className={`${cardClass} mt-8`}>
          <EmptyState icon={Wallet} title="No cash or bank account" description="Add one in the chart of accounts." />
        </div>
      )}
    </>
  );
}

export default function CashPage({ params, searchParams }: PageProps<"/c/[company]/finance/cash">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading cash & bank…</p>}>
      <CashContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
