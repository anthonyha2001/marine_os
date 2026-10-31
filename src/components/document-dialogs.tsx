import Link from "next/link";
import { ExternalLink, FileDown, HandCoins, ReceiptText, Truck } from "lucide-react";
import { billStatus } from "@/lib/accounting";
import { listPurchasePayments } from "@/lib/data/accounting";
import { getPurchase } from "@/lib/data/inventory";
import { invoiceSettlements } from "@/lib/data/ledger";
import { getInvoice, getOffer } from "@/lib/data/sales";
import { dayFormat, dueInWords, isOverdue } from "@/lib/dates";
import { formatMoney, round2 } from "@/lib/money";
import type { CompanySlug } from "@/lib/permissions";
import { BillStatusBadge } from "@/app/c/[company]/accounting/bill-status";
import { InvoiceStatusBadge } from "@/app/c/[company]/invoices/status-badge";
import { Modal } from "@/components/modal";
import { cardClass, primaryButton, secondaryButton } from "@/components/ui";

// What's inside a purchase, invoice or offer, in a pop-up opened by double-clicking its row.

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className={`${cardClass} grid gap-3 p-4 sm:grid-cols-2`}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
          <dd className="mt-0.5 font-medium text-navy">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Totals({ rows }: { rows: [string, number, boolean?][] }) {
  return (
    <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
      {rows.map(([label, value, strong]) => (
        <div key={label} className={`flex justify-between gap-6 ${strong ? "border-t border-border pt-1 font-semibold text-navy" : "text-muted"}`}>
          <dt>{label}</dt>
          <dd className="tabular">{formatMoney(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

const th = "px-3 py-2";
const num = "px-3 py-2 text-right tabular";
const tableHead = "border-b border-border text-xs uppercase tracking-wider text-muted";

function Due({ date, open }: { date: Date; open: boolean }) {
  return (
    <>
      {dayFormat.format(date)}
      {open && <span className={`block text-xs font-normal ${isOverdue(date) ? "text-danger" : "text-muted"}`}>{dueInWords(date)}</span>}
    </>
  );
}

export async function PurchaseDialog({ slug, id, closeHref, canPay, canOpen }: { slug: CompanySlug; id: string; closeHref: string; canPay: boolean; canOpen: boolean }) {
  const [purchase, payments] = await Promise.all([getPurchase(slug, id), listPurchasePayments(slug, id)]);
  if (!purchase) return null;
  const paid = round2(payments.filter((p) => p.status === "POSTED").reduce((s, p) => s + p.amount, 0));
  const balance = round2(purchase.totalTTC - paid);
  return (
    <Modal title={`Purchase · invoice ${purchase.invoiceNumber}`} closeHref={closeHref} size="lg">
      <div className="space-y-4">
        <Facts
          items={[
            ["Supplier invoice no.", <span key="n" className="font-mono">{purchase.invoiceNumber}</span>],
            ["Supplier", purchase.supplierName],
            ["Invoice date", dayFormat.format(purchase.purchaseDate)],
            ["Due", <Due key="d" date={purchase.dueDate} open={balance > 0} />],
            ["Status", <BillStatusBadge key="s" status={billStatus(purchase.totalTTC, paid, purchase.dueDate)} />],
            ...(purchase.purchaseOrder ? ([["Purchase order", purchase.purchaseOrder.number]] as [string, React.ReactNode][]) : []),
          ]}
        />
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className={tableHead}>
              <tr>
                <th className={th}>Code</th>
                <th className={th}>Product</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>Unit price excl. VAT</th>
                <th className={`${th} text-right`}>Total excl. VAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchase.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{i.code}</td>
                  <td className="px-3 py-2 font-medium text-navy">{i.name}</td>
                  <td className={num}>{i.quantity}</td>
                  <td className={num}>{formatMoney(i.unitPriceHT)}</td>
                  <td className={num}>{formatMoney(i.lineTotalHT)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Totals
          rows={[
            ["Total excl. VAT", purchase.totalHT],
            ["VAT", purchase.vatAmount],
            ["Total", purchase.totalTTC, true],
            ["Paid", paid],
            ["Left to pay", balance, true],
          ]}
        />
        {purchase.notes && <p className="text-sm text-muted">{purchase.notes}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {canOpen && (
            <Link href={`/c/${slug}/purchases/${purchase.id}`} className={secondaryButton}>
              <ExternalLink className="size-4" aria-hidden /> Open purchase
            </Link>
          )}
          {canPay && balance > 0 && (
            <Link href={`/c/${slug}/finance/vouchers?new=SUPPLIER&bill=${purchase.id}`} className={primaryButton}>
              <Truck className="size-4" aria-hidden /> Pay (PV)
            </Link>
          )}
        </div>
      </div>
    </Modal>
  );
}

export async function InvoiceDialog({ slug, id, closeHref, canReceive, canOpen }: { slug: CompanySlug; id: string; closeHref: string; canReceive: boolean; canOpen: boolean }) {
  const [invoice, settled] = await Promise.all([getInvoice(slug, id), invoiceSettlements(slug)]);
  if (!invoice) return null;
  const s = settled.get(invoice.id) ?? { paid: 0, credited: 0 };
  const done = round2(s.paid + s.credited);
  const balance = invoice.status === "CANCELLED" ? 0 : Math.max(0, round2(invoice.totalTTC - done));
  return (
    <Modal title={`Invoice ${invoice.number}`} closeHref={closeHref} size="lg">
      <div className="space-y-4">
        <Facts
          items={[
            ["Invoice no.", <span key="n" className="font-mono">{invoice.number}</span>],
            ["Customer", invoice.customerName],
            ["Invoice date", dayFormat.format(invoice.invoiceDate)],
            ["Due", <Due key="d" date={invoice.dueDate} open={balance > 0} />],
            ["Status", <InvoiceStatusBadge key="s" status={invoice.status} dueDate={invoice.dueDate} partial={done > 0} />],
            ...(invoice.subject ? ([["Subject", invoice.subject]] as [string, React.ReactNode][]) : []),
            ...(invoice.offer ? ([["From offer", invoice.offer.number]] as [string, React.ReactNode][]) : []),
          ]}
        />
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className={tableHead}>
              <tr>
                <th className={th}>Description</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>Unit price</th>
                <th className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-navy">{l.title}</span>
                    {l.description && <span className="block text-xs text-muted">{l.description}</span>}
                  </td>
                  <td className={num}>{l.quantity}</td>
                  <td className={num}>{formatMoney(l.unitPrice)}</td>
                  <td className={num}>{formatMoney(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Totals
          rows={[
            ["Total excl. VAT", invoice.totalHT],
            ["VAT", invoice.vatAmount],
            ["Total", invoice.totalTTC, true],
            ["Paid and credited", done],
            ["Balance due", balance, true],
          ]}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <a href={`/c/${slug}/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener" className={secondaryButton}>
            <FileDown className="size-4" aria-hidden /> Open PDF
          </a>
          {canOpen && (
            <Link href={`/c/${slug}/invoices/${invoice.id}`} className={secondaryButton}>
              <ExternalLink className="size-4" aria-hidden /> Open invoice
            </Link>
          )}
          {canReceive && balance > 0 && (
            <Link href={`/c/${slug}/finance/vouchers?new=CUSTOMER&invoice=${invoice.id}`} className={primaryButton}>
              <HandCoins className="size-4" aria-hidden /> Receive payment (RV)
            </Link>
          )}
        </div>
      </div>
    </Modal>
  );
}

export async function OfferDialog({ slug, id, closeHref, canInvoice }: { slug: CompanySlug; id: string; closeHref: string; canInvoice: boolean }) {
  const offer = await getOffer(slug, id);
  if (!offer) return null;
  const remaining = round2(offer.totalTTC - offer.invoicedTTC);
  return (
    <Modal title={`Offer ${offer.number}`} closeHref={closeHref} size="lg">
      <div className="space-y-4">
        <Facts
          items={[
            ["Offer no.", <span key="n" className="font-mono">{offer.number}</span>],
            ["Customer", offer.customerName],
            ["Offer date", dayFormat.format(offer.offerDate)],
            ["Valid until", <Due key="d" date={offer.validUntil} open={offer.status !== "ACCEPTED" && offer.status !== "REJECTED"} />],
            ...(offer.subject ? ([["Subject", offer.subject]] as [string, React.ReactNode][]) : []),
          ]}
        />
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className={tableHead}>
              <tr>
                <th className={th}>Description</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>Unit price</th>
                <th className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {offer.lines.map((l) =>
                l.kind === "SECTION" ? (
                  <tr key={l.id} className="bg-background">
                    <td colSpan={4} className="px-3 py-2 font-semibold text-navy">{l.title}</td>
                  </tr>
                ) : (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      <span className="font-medium text-navy">{l.title}</span>
                      {l.code && <span className="ml-2 font-mono text-xs text-muted">{l.code}</span>}
                      {l.description && <span className="block text-xs text-muted">{l.description}</span>}
                    </td>
                    <td className={num}>{l.quantity} {l.unit}</td>
                    <td className={num}>{formatMoney(l.unitPrice)}</td>
                    <td className={num}>{formatMoney(l.lineTotal)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <Totals
          rows={[
            ...(offer.discountTotal > 0 ? ([["Discount", -offer.discountTotal]] as [string, number][]) : []),
            ["Total excl. VAT", offer.totalHT],
            ["VAT", offer.vatAmount],
            ["Total", offer.totalTTC, true],
            ["Invoiced", offer.invoicedTTC],
            ["Left to invoice", remaining, true],
          ]}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={`/c/${slug}/offers/${offer.id}`} className={secondaryButton}>
            <ExternalLink className="size-4" aria-hidden /> Open offer
          </Link>
          {canInvoice && offer.status !== "REJECTED" && remaining > 0 && (
            <Link href={`/c/${slug}/offers/${offer.id}#invoicing`} className={primaryButton}>
              <ReceiptText className="size-4" aria-hidden /> Issue invoice
            </Link>
          )}
        </div>
      </div>
    </Modal>
  );
}
