import Link from "next/link";
import { FileDown } from "lucide-react";
import { deleteSupplierPayment } from "@/lib/actions/accounting";
import { PAYMENT_METHODS, billStatus } from "@/lib/accounting";
import { listPurchasePayments } from "@/lib/data/accounting";
import { listMoneyAccounts } from "@/lib/data/ledger";
import { formatMoney, round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { Modal } from "@/components/modal";
import { cardClass, secondaryButton, ProgressBar } from "@/components/ui";
import { BillStatusBadge } from "../../accounting/bill-status";
import { RecordPaymentForm } from "../../accounting/record-payment-form";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/** What has been paid to the supplier for this purchase, and what is left. */
export async function PaymentsSection({
  slug,
  purchase,
  canRecord,
  paying,
}: {
  slug: CompanySlug;
  purchase: { id: string; invoiceNumber: string; supplierName: string; totalTTC: number; dueDate: Date };
  canRecord: boolean;
  paying: boolean;
}) {
  const payments = await listPurchasePayments(slug, purchase.id);
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const balance = round2(purchase.totalTTC - paid);
  const status = billStatus(purchase.totalTTC, paid, purchase.dueDate);
  const pageUrl = `/c/${slug}/purchases/${purchase.id}`;

  return (
    <section className={`${cardClass} mt-6 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-3 font-semibold text-navy">
            Payments to the supplier <BillStatusBadge status={status} />
          </h2>
          <p className="mt-1 text-sm text-muted">
            Paid {formatMoney(paid)} of {formatMoney(purchase.totalTTC)} · due {dateFormat.format(purchase.dueDate)} ·{" "}
            <span className="font-semibold text-navy">{balance > 0 ? `${formatMoney(balance)} left to pay` : "fully paid"}</span>
          </p>
          <ProgressBar value={purchase.totalTTC > 0 ? paid / purchase.totalTTC : 1} label="Paid" className="mt-2 max-w-sm" />
        </div>
        {canRecord && balance > 0 && (
          <Link href={`${pageUrl}?pay=1`} scroll={false} className={secondaryButton}>
            Record payment
          </Link>
        )}
      </div>

      {payments.length > 0 && (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="py-2 pr-3">Voucher</th>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Method</th>
              <th className="py-2 pr-3">Reference</th>
              <th className="py-2 pr-3">Recorded by</th>
              <th className="py-2 pr-3 text-right">Amount</th>
              {canRecord && <th className="py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="py-2 pr-3">
                  {p.number && canRecord ? (
                    <a href={`/c/${slug}/finance/vouchers/${p.id}/pdf`} target="_blank" rel="noopener" title="Print payment voucher" className="inline-flex items-center gap-1 font-mono text-xs font-medium text-brand hover:underline">
                      <FileDown className="size-3.5" aria-hidden /> {p.number}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-muted">{p.number ?? "—"}</span>
                  )}
                </td>
                <td className="py-2 pr-3">{dateFormat.format(p.paidAt)}</td>
                <td className="py-2 pr-3">{PAYMENT_METHODS[p.method] ?? p.method}</td>
                <td className="py-2 pr-3 text-muted">{p.reference ?? "—"}</td>
                <td className="py-2 pr-3 text-muted">{p.createdByName}</td>
                <td className="py-2 pr-3 text-right font-medium">{formatMoney(p.amount)}</td>
                {canRecord && (
                  <td className="py-2 text-right">
                    <DeleteButton
                      action={deleteSupplierPayment.bind(null, slug, p.id)}
                      confirmText={`Delete the ${formatMoney(p.amount)} payment of ${dateFormat.format(p.paidAt)}? Use this only for a payment entered by mistake.`}
                      title="Delete payment"
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {paying && canRecord && balance > 0 && (
        <Modal title="Record a supplier payment" closeHref={pageUrl} size="md">
          <RecordPaymentForm
            key={crypto.randomUUID()}
            companySlug={slug}
            purchaseId={purchase.id}
            supplierName={purchase.supplierName}
            invoiceNumber={purchase.invoiceNumber}
            total={purchase.totalTTC}
            balance={balance}
            returnTo="purchase"
            accounts={await listMoneyAccounts(slug)}
          />
        </Modal>
      )}
    </section>
  );
}
