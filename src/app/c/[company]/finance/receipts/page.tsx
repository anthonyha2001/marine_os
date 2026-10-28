import { Suspense } from "react";
import Link from "next/link";
import { HandCoins, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { deleteReceipt } from "@/lib/actions/finance";
import { PAYMENT_METHODS } from "@/lib/accounting";
import { businessToday, dayFormat } from "@/lib/dates";
import { invoicesWithBalance, listMoneyAccounts, listReceipts } from "@/lib/data/ledger";
import { listCustomers } from "@/lib/data/sales";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { Modal } from "@/components/modal";
import { ButtonLink, EmptyState, PageHeader, SearchBar, StatCard, cardClass, tdClass, thClass } from "@/components/ui";
import { ReceiptForm } from "./receipt-form";

type Search = { q?: string; new?: string; saved?: string };

async function ReceiptsContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, { q = "", new: creating, saved }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "invoices");
  const base = `/c/${slug}/finance/receipts`;
  const [receipts, open] = await Promise.all([listReceipts(slug), invoicesWithBalance(slug)]);
  const needle = q.trim().toLowerCase();
  const shown = receipts.filter(
    (r) => !needle || r.number.toLowerCase().includes(needle) || r.customerName.toLowerCase().includes(needle) || (r.invoice?.number ?? "").toLowerCase().includes(needle),
  );
  const month = businessToday().slice(0, 7);
  const thisMonth = round2(receipts.filter((r) => r.receivedAt.toISOString().slice(0, 7) === month).reduce((s, r) => s + r.amount, 0));
  const onAccount = round2(receipts.filter((r) => !r.invoice).reduce((s, r) => s + r.amount, 0));
  const toCollect = round2(open.reduce((s, i) => s + i.balance, 0));

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Finance`}
        title="Customer receipts"
        description="Money received from customers, against invoices or on account. Each receipt posts to cash or bank and reduces what the customer owes."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New receipt</ButtonLink>}
      />
      {saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Receipt recorded.
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Received this month" value={formatMoney(thisMonth)} icon={HandCoins} />
        <StatCard label="Still to collect" value={formatMoney(toCollect)} hint={`${open.filter((i) => i.balance > 0).length} open invoices`} href={`/c/${slug}/invoices`} />
        <StatCard label="Received on account" value={formatMoney(onAccount)} hint="advances not linked to an invoice" />
      </div>
      <div className="mt-6">
        <SearchBar action={base} defaultValue={q} placeholder="Search by receipt, customer or invoice" />
      </div>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {shown.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title={q ? "No receipts match this search" : "No receipts yet"}
            description="Record a payment from an invoice, or here for an advance on account."
          />
        ) : (
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Receipt</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Customer</th>
                <th className={thClass}>Invoice</th>
                <th className={thClass}>Method · account</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/60">
                  <td className={`${tdClass} font-mono text-xs font-medium text-navy`}>{r.number}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{dayFormat.format(r.receivedAt)}</td>
                  <td className={`${tdClass} font-medium text-navy`}>{r.customerName}</td>
                  <td className={tdClass}>
                    {r.invoice ? (
                      <Link href={`/c/${slug}/invoices/${r.invoice.id}`} className="font-mono text-xs text-brand hover:underline">
                        {r.invoice.number}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">On account</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-muted`}>
                    {PAYMENT_METHODS[r.method as keyof typeof PAYMENT_METHODS] ?? r.method} · {r.moneyAccount}
                    {r.reference && <span className="block text-xs">{r.reference}</span>}
                  </td>
                  <td className={`${tdClass} tabular text-right font-semibold`}>{formatMoney(r.amount)}</td>
                  <td className={`${tdClass} text-right`}>
                    <DeleteButton
                      action={deleteReceipt.bind(null, slug, r.id)}
                      confirmText={`Delete receipt ${r.number} of ${formatMoney(r.amount)}? Its accounting entry is removed.`}
                      title="Delete receipt"
                      successMessage="Receipt deleted."
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <Modal title="New customer receipt" closeHref={base} size="md">
          <NewReceipt slug={slug} open={open.filter((i) => i.balance > 0)} />
        </Modal>
      )}
    </>
  );
}

async function NewReceipt({ slug, open }: { slug: Parameters<typeof listMoneyAccounts>[0]; open: Awaited<ReturnType<typeof invoicesWithBalance>> }) {
  const [accounts, customers] = await Promise.all([listMoneyAccounts(slug), listCustomers()]);
  return (
    <ReceiptForm
      key={crypto.randomUUID()}
      companySlug={slug}
      accounts={accounts}
      invoices={open.map((i) => ({ id: i.id, number: i.number, customerName: i.customerName, totalTTC: i.totalTTC, balance: i.balance }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}

export default function ReceiptsPage({ params, searchParams }: PageProps<"/c/[company]/finance/receipts">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading receipts…</p>}>
      <ReceiptsContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
