import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, FileCheck2 } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { businessToday, dayFormat } from "@/lib/dates";
import { listBills } from "@/lib/data/accounting";
import { CHEQUE_STATUS, isOpenCheque, listCheques, type ChequeStatus } from "@/lib/data/cheques";
import { invoicesWithBalance, listMoneyAccounts } from "@/lib/data/ledger";
import { listCustomers } from "@/lib/data/sales";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { Badge, EmptyState, PageHeader, StatCard, cardClass, primaryButton, secondaryButton, secondaryButtonSm, tdClass, thClass } from "@/components/ui";
import { LinkTabs } from "../finance-ui";
import { ChequeRowActions, ClearChequeForm, IssuedChequeForm, ReceivedChequeForm } from "./cheque-forms";

type Search = { view?: string; new?: string; clear?: string; saved?: string; cleared?: string };
const TONE: Record<ChequeStatus, "amber" | "blue" | "green" | "red" | "gray"> = { IN_HAND: "amber", DEPOSITED: "blue", ISSUED: "amber", CLEARED: "green", BOUNCED: "red", CANCELLED: "gray" };

async function ChequesContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "accounting");
  const base = `/c/${slug}/finance/cheques`;
  const all = await listCheques(slug);
  const todayIso = businessToday();
  const weekIso = new Date(new Date(`${todayIso}T00:00:00Z`).getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const view = ["received", "issued", "settled", "all"].includes(search.view ?? "") ? search.view! : "received";
  const shown = all.filter((c) =>
    view === "received" ? c.direction === "RECEIVED" && isOpenCheque(c) : view === "issued" ? c.direction === "ISSUED" && isOpenCheque(c) : view === "settled" ? !isOpenCheque(c) : true,
  );
  const openIn = all.filter((c) => c.direction === "RECEIVED" && isOpenCheque(c));
  const openOut = all.filter((c) => c.direction === "ISSUED" && isOpenCheque(c));
  const dueSoon = all.filter((c) => isOpenCheque(c) && c.dueDate.toISOString().slice(0, 10) <= weekIso);
  const clearing = search.clear ? all.find((c) => c.id === search.clear && isOpenCheque(c)) : undefined;

  const [invoices, customers, bills, accounts] = await Promise.all([
    search.new === "received" ? invoicesWithBalance(slug) : [],
    search.new === "received" ? listCustomers() : [],
    search.new === "issued" ? listBills(slug) : [],
    clearing ? listMoneyAccounts(slug) : [],
  ]);

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Finance`}
        title="Cheques"
        description="Cheques received from customers and given to suppliers, usually post-dated. They settle the invoice or bill at once; the bank moves the money on the cheque date."
        action={
          <>
            <Link href={`${base}?view=${view}&new=received`} scroll={false} className={primaryButton}>
              <ArrowDownLeft className="size-4" aria-hidden /> Cheque received
            </Link>
            <Link href={`${base}?view=${view}&new=issued`} scroll={false} className={secondaryButton}>
              <ArrowUpRight className="size-4" aria-hidden /> Cheque given
            </Link>
          </>
        }
      />
      {(search.saved || search.cleared) && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          {search.cleared ? "Cheque cleared: the bank balance is updated." : "Cheque recorded."}
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="To collect" value={formatMoney(round2(openIn.reduce((s, c) => s + c.amount, 0)))} hint={`${openIn.length} cheque${openIn.length === 1 ? "" : "s"} received`} icon={FileCheck2} />
        <StatCard label="To be paid by the bank" value={formatMoney(round2(openOut.reduce((s, c) => s + c.amount, 0)))} hint={`${openOut.length} cheque${openOut.length === 1 ? "" : "s"} given`} />
        <StatCard label="Due within 7 days" value={String(dueSoon.length)} hint={dueSoon.length ? formatMoney(round2(dueSoon.reduce((s, c) => s + c.amount, 0))) : "nothing due"} tone={dueSoon.length ? "danger" : "default"} />
      </div>
      <div className="mt-6">
        <LinkTabs
          active={view}
          tabs={[
            { key: "received", label: `Received (${openIn.length})`, href: base },
            { key: "issued", label: `Given (${openOut.length})`, href: `${base}?view=issued` },
            { key: "settled", label: "Cleared, bounced & cancelled", href: `${base}?view=settled` },
            { key: "all", label: `All (${all.length})`, href: `${base}?view=all` },
          ]}
        />
      </div>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {shown.length === 0 ? (
          <EmptyState icon={FileCheck2} title="No cheques here" />
        ) : (
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Cheque</th>
                <th className={thClass}>From / to</th>
                <th className={thClass}>For</th>
                <th className={thClass}>Cheque date</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={thClass}>Status</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((c) => {
                const due = c.dueDate.toISOString().slice(0, 10);
                const late = isOpenCheque(c) && due <= todayIso;
                return (
                  <tr key={c.id} className="hover:bg-surface-2/60">
                    <td className={tdClass}>
                      <span className="font-mono font-medium text-navy">{c.chequeNumber}</span>
                      <span className="block text-xs text-muted">
                        {c.number}
                        {c.bank && ` · ${c.bank}`}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span className="text-xs text-muted">{c.direction === "RECEIVED" ? "From " : "To "}</span>
                      {c.partyName}
                    </td>
                    <td className={tdClass}>
                      {c.invoice ? (
                        <Link href={`/c/${slug}/invoices/${c.invoice.id}`} className="font-mono text-xs text-brand hover:underline">
                          {c.invoice.number}
                        </Link>
                      ) : c.bill ? (
                        <Link href={`/c/${slug}/purchases/${c.bill.id}`} className="font-mono text-xs text-brand hover:underline">
                          Bill {c.bill.invoiceNumber}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted">{c.direction === "RECEIVED" ? "On account" : "—"}</span>
                      )}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap ${late ? "font-medium text-danger" : ""}`}>
                      {dayFormat.format(c.dueDate)}
                      {late && <span className="block text-xs">{due === todayIso ? "today" : "due"}</span>}
                    </td>
                    <td className={`${tdClass} tabular text-right font-semibold`}>{formatMoney(c.amount)}</td>
                    <td className={tdClass}>
                      <Badge tone={TONE[c.status]}>{CHEQUE_STATUS[c.status]}</Badge>
                      {c.clearedAt && <span className="block text-xs text-muted">{dayFormat.format(c.clearedAt)}</span>}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      {isOpenCheque(c) && (
                        <Link href={`${base}?view=${view}&clear=${c.id}`} scroll={false} className={`${secondaryButtonSm} mr-1`}>
                          Cleared
                        </Link>
                      )}
                      {c.status !== "BOUNCED" && c.status !== "CANCELLED" && <ChequeRowActions companySlug={slug} chequeId={c.id} label={c.chequeNumber} status={c.status} direction={c.direction} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {search.new === "received" && (
        <Modal title="Cheque received" closeHref={`${base}?view=${view}`} size="lg">
          <ReceivedChequeForm
            key={crypto.randomUUID()}
            companySlug={slug}
            invoices={invoices.filter((i) => i.balance > 0).map((i) => ({ id: i.id, label: `${i.number} · ${i.customerName} · ${formatMoney(i.balance)} due`, customerId: i.customerId, balance: i.balance }))}
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          />
        </Modal>
      )}
      {search.new === "issued" && (
        <Modal title="Cheque given to a supplier" closeHref={`${base}?view=${view}`} size="lg">
          <IssuedChequeForm
            key={crypto.randomUUID()}
            companySlug={slug}
            bills={bills.filter((b) => b.balance > 0).map((b) => ({ id: b.id, label: `${b.supplierName} · ${b.invoiceNumber} · ${formatMoney(b.balance)} due`, balance: b.balance }))}
          />
        </Modal>
      )}
      {clearing && (
        <Modal title={`Cheque ${clearing.chequeNumber} cleared`} closeHref={`${base}?view=${view}`} size="md">
          <ClearChequeForm key={crypto.randomUUID()} companySlug={slug} chequeId={clearing.id} amount={clearing.amount} accounts={accounts} />
        </Modal>
      )}
    </>
  );
}

export default function ChequesPage({ params, searchParams }: PageProps<"/c/[company]/finance/cheques">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading cheques…</p>}>
      <ChequesContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
