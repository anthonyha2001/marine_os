import { Suspense } from "react";
import { payHref } from "@/lib/url";
import Link from "next/link";
import { HandCoins } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { deleteReceipt } from "@/lib/actions/finance";
import { PAYMENT_METHODS } from "@/lib/accounting";
import { businessToday, dayFormat } from "@/lib/dates";
import { invoicesWithBalance, listReceipts } from "@/lib/data/ledger";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { ButtonLink, EmptyState, PageHeader, SearchBar, StatCard, cardClass, tdClass, thClass } from "@/components/ui";
import { CancelButton, CancelledNote } from "@/components/cancel-button";
import { cancelReceipt } from "@/lib/actions/cancel";
import { can, canAccessModule, isAdmin } from "@/lib/permissions";

type Search = { q?: string };

async function ReceiptsContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, { q = "" }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "invoices");
  const base = `/c/${slug}/finance/receipts`;
  const admin = isAdmin(user);
  const mayCancel = can(user, "cancelEntries");
  const [receipts, open] = await Promise.all([listReceipts(slug), invoicesWithBalance(slug)]);
  const needle = q.trim().toLowerCase();
  const shown = receipts.filter(
    (r) => !needle || r.number.toLowerCase().includes(needle) || r.customerName.toLowerCase().includes(needle) || (r.invoice?.number ?? "").toLowerCase().includes(needle),
  );
  const month = businessToday().slice(0, 7);
  const posted = receipts.filter((r) => r.status === "POSTED");
  const thisMonth = round2(posted.filter((r) => r.receivedAt.toISOString().slice(0, 7) === month).reduce((s, r) => s + r.amount, 0));
  const onAccount = round2(posted.filter((r) => !r.invoice).reduce((s, r) => s + r.amount, 0));
  const toCollect = round2(open.reduce((s, i) => s + i.balance, 0));

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Money`}
        title="Customer receipts"
        description="Money received from customers, against invoices or on account. New customer payments are entered under Vouchers, as receipt vouchers (RV)."
        action={canAccessModule(user, slug, "accounting") && <ButtonLink icon={HandCoins} href={payHref(`/c/${slug}/finance/receipts`, "CUSTOMER")}>Customer payment</ButtonLink>}
      />
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
            description="Customer payments are entered under Vouchers."
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
                <tr key={r.id} className={`hover:bg-surface-2/60 ${r.status === "CANCELLED" ? "opacity-60" : ""}`}>
                  <td className={`${tdClass} font-mono text-xs font-medium text-navy`}>
                    {r.number}
                    {r.status === "CANCELLED" && <CancelledNote by={r.cancelledByName} reason={r.cancelReason} />}
                  </td>
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
                  <td className={`${tdClass} tabular text-right font-semibold ${r.status === "CANCELLED" ? "line-through" : ""}`}>{formatMoney(r.amount)}</td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    {r.status === "POSTED" && mayCancel && (
                      <CancelButton
                        action={cancelReceipt.bind(null, slug, r.id)}
                        title="Cancel receipt"
                        message={`Receipt ${r.number} of ${formatMoney(r.amount)} stays on record as cancelled, and a reversing entry is posted today.`}
                      />
                    )}
                    {admin && (
                      <DeleteButton
                        action={deleteReceipt.bind(null, slug, r.id)}
                        confirmText={`Delete receipt ${r.number} of ${formatMoney(r.amount)}? It goes to the recycle bin with its accounting entry, and can be restored.`}
                        title="Delete receipt"
                        successMessage="Receipt moved to the recycle bin."
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function ReceiptsPage({ params, searchParams }: PageProps<"/c/[company]/finance/receipts">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading receipts…</p>}>
      <ReceiptsContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
