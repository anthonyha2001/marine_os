import Link from "next/link";
import { payHref } from "@/lib/url";
import { FileDown } from "lucide-react";
import { deleteSupplierPayment } from "@/lib/actions/accounting";
import { PAYMENT_METHODS, billStatus } from "@/lib/accounting";
import { listPurchasePayments } from "@/lib/data/accounting";
import { formatMoney, round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { cardClass, secondaryButton, ProgressBar } from "@/components/ui";
import { BillStatusBadge } from "../../accounting/bill-status";
import { CancelButton, CancelledNote } from "@/components/cancel-button";
import { cancelSupplierPayment } from "@/lib/actions/cancel";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/** What has been paid to the supplier for this purchase, and what is left. */
export async function PaymentsSection({
  slug,
  purchase,
  canRecord,
  admin = false,
  mayCancel = false,
}: {
  slug: CompanySlug;
  admin?: boolean;
  mayCancel?: boolean;
  purchase: { id: string; invoiceNumber: string; supplierName: string; totalTTC: number; dueDate: Date };
  canRecord: boolean;
}) {
  const payments = await listPurchasePayments(slug, purchase.id);
  const paid = round2(payments.filter((p) => p.status === "POSTED").reduce((s, p) => s + p.amount, 0));
  const balance = round2(purchase.totalTTC - paid);
  const status = billStatus(purchase.totalTTC, paid, purchase.dueDate);

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
          <Link href={payHref(`/c/${slug}/purchases/${purchase.id}`, "SUPPLIER", { bill: purchase.id })} scroll={false} className={secondaryButton}>
            Pay (PV)
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
              <tr key={p.id} className={p.status === "CANCELLED" ? "opacity-60" : ""}>
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
                <td className="py-2 pr-3 text-muted">
                  {p.reference ?? "—"}
                  {p.status === "CANCELLED" && <CancelledNote by={p.cancelledByName} reason={p.cancelReason} />}
                </td>
                <td className="py-2 pr-3 text-muted">{p.createdByName}</td>
                <td className={`py-2 pr-3 text-right font-medium ${p.status === "CANCELLED" ? "line-through" : ""}`}>{formatMoney(p.amount)}</td>
                {canRecord && (
                  <td className="whitespace-nowrap py-2 text-right">
                    {p.status === "POSTED" && mayCancel && (
                      <CancelButton
                        action={cancelSupplierPayment.bind(null, slug, p.id)}
                        title="Cancel payment"
                        message={`Payment ${p.number ?? ""} of ${formatMoney(p.amount)} stays on record as cancelled, and a reversing entry is posted today. The bill goes back to unpaid for that amount.`}
                      />
                    )}
                    {admin && (
                      <DeleteButton
                        action={deleteSupplierPayment.bind(null, slug, p.id)}
                        confirmText={`Delete the ${formatMoney(p.amount)} payment of ${dateFormat.format(p.paidAt)}? It goes to the recycle bin with its accounting entry, and can be restored.`}
                        title="Delete payment"
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
