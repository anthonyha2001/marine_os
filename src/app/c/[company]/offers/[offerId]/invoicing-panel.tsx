import Link from "next/link";
import { createInvoicesFromOffer } from "@/lib/actions/invoices";
import type { OfferDetail } from "@/lib/data/sales";
import { formatMoney, round2 } from "@/lib/money";
import { INVOICE_STATUSES, dueLabel, projectedPayments, type InvoiceStatus } from "@/lib/offers";
import { cardClass, primaryButton, secondaryButton, secondaryButtonSm, ProgressBar } from "@/components/ui";

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  ISSUED: "bg-amber-50 text-amber-700",
  PAID: "bg-green-50 text-success",
  CANCELLED: "bg-gray-100 text-muted",
};

function InvoiceLink({ companySlug, invoice }: { companySlug: string; invoice: { id: string; number: string; status: InvoiceStatus } }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Link href={`/c/${companySlug}/invoices/${invoice.id}`} className="font-mono font-medium text-brand hover:underline">
        {invoice.number}
      </Link>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[invoice.status]}`}>
        {INVOICE_STATUSES[invoice.status]}
      </span>
    </span>
  );
}

/** The offer's payment schedule (one invoice per payment) plus any custom invoices. */
export function InvoicingPanel({ companySlug, offer }: { companySlug: string; offer: OfferDetail }) {
  const remaining = round2(offer.totalTTC - offer.invoicedTTC);
  const projected = projectedPayments(
    offer.paymentTerms.map((t) => ({ id: t.id, amount: t.amount, invoiced: !!t.invoice })),
    offer.totalTTC,
    offer.invoicedTTC,
  );
  const open = offer.paymentTerms.filter((t) => !t.invoice && (projected.get(t.id) ?? 0) > 0);
  const createAll = createInvoicesFromOffer.bind(null, companySlug, offer.id, null);
  const activeCustom = offer.customInvoices.filter((i) => i.status !== "CANCELLED");

  return (
    <section className={`${cardClass} mt-6 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy">Invoicing</h2>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="inline text-muted">Offer total </dt>
              <dd className="inline font-medium">{formatMoney(offer.totalTTC)}</dd>
            </div>
            <div>
              <dt className="inline text-muted">Invoiced </dt>
              <dd className="inline font-medium">{formatMoney(offer.invoicedTTC)}</dd>
            </div>
            <div>
              <dt className="inline text-muted">Left to invoice </dt>
              <dd className={`inline font-semibold ${remaining > 0 ? "text-navy" : "text-success"}`}>
                {remaining > 0 ? formatMoney(remaining) : "Fully invoiced ✓"}
              </dd>
            </div>
          </dl>
          <ProgressBar value={offer.totalTTC > 0 ? offer.invoicedTTC / offer.totalTTC : 0} label="Invoiced" className="mt-2 max-w-sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          {remaining > 0 && (
            <Link href={`/c/${companySlug}/offers/${offer.id}?invoice=custom`} scroll={false} className={secondaryButton}>
              + Custom invoice
            </Link>
          )}
          {open.length > 1 && (
            <form action={createAll}>
              <button type="submit" className={primaryButton}>
                Create all {open.length} invoices
              </button>
            </form>
          )}
        </div>
      </div>

      {offer.paymentTerms.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          This offer has no payment terms yet. Choose them in the Payment terms section below and save (Ctrl+S). You can
          still create a custom invoice for any amount.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Payment</th>
                <th className="py-2 pr-3 text-right">Share</th>
                <th className="py-2 pr-3 text-right">Amount incl. VAT</th>
                <th className="py-2 pr-3">Due</th>
                <th className="py-2 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {offer.paymentTerms.map((term, i) => {
                const amount = projected.get(term.id) ?? 0;
                const reduced = !term.invoice && amount < term.amount;
                return (
                  <tr key={term.id}>
                    <td className="py-2.5 pr-3 text-muted">{i + 1}</td>
                    <td className="py-2.5 pr-3 font-medium text-navy">{term.label}</td>
                    <td className="py-2.5 pr-3 text-right">{Math.round(term.percent * 100) / 100}%</td>
                    <td className="py-2.5 pr-3 text-right font-medium">
                      {reduced ? (
                        <span title={`Scheduled ${formatMoney(term.amount)}; reduced by custom invoices`}>
                          <span className="mr-1.5 text-xs text-muted line-through">{formatMoney(term.amount)}</span>
                          {formatMoney(amount)}
                        </span>
                      ) : (
                        formatMoney(term.amount)
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-muted">{dueLabel(term.dueDays)}</td>
                    <td className="py-2.5 text-right">
                      {term.invoice ? (
                        <InvoiceLink companySlug={companySlug} invoice={term.invoice} />
                      ) : amount > 0 ? (
                        <form action={createInvoicesFromOffer.bind(null, companySlug, offer.id, term.id)}>
                          <button type="submit" className={secondaryButtonSm}>
                            Create invoice
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted">Covered by earlier invoices</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {offer.customInvoices.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Custom invoices</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {offer.customInvoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3">
                <InvoiceLink companySlug={companySlug} invoice={inv} />
                <span className={inv.status === "CANCELLED" ? "text-muted line-through" : "font-medium"}>{formatMoney(inv.totalTTC)}</span>
              </li>
            ))}
          </ul>
          {activeCustom.length > 0 && (
            <p className="mt-2 text-xs text-muted">Custom invoices reduce the scheduled payments that aren&apos;t invoiced yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
