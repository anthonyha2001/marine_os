import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Printer, Undo2, UserRound } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { getSale } from "@/lib/data/pos";
import { formatMoney, round2, withVat } from "@/lib/money";
import { REFUND_METHODS, SALE_STATUS, formatLbp, formatRate, hasPos } from "@/lib/pos";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { Badge, PageHeader, cardClass, primaryButton, secondaryButton, tdClass, thClass } from "@/components/ui";
import { RefundForm, SaleCustomerForm } from "./sale-forms";

type Search = { refund?: string; customer?: string; refunded?: string };
const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Beirut" });

async function SaleDetail({ params, searchParams }: { params: Promise<{ company: string; saleId: string }>; searchParams: Promise<Search> }) {
  const [{ company, saleId }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "sales");
  if (!hasPos(slug)) notFound();
  const sale = await getSale(slug, saleId);
  if (!sale || (user.role === "CASHIER" && sale.cashierId !== user.id)) notFound();
  const base = `/c/${slug}/pos/sales/${sale.id}`;
  const refunded = round2(sale.refunds.reduce((s, r) => s + r.totalTTC, 0));
  const canRefund = sale.status !== "REFUNDED";

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Counter sale`}
        title={sale.number}
        description={`${stamp.format(sale.createdAt)} · ${sale.cashierName} · ${sale.customerName}`}
        action={
          <>
            <a href={`${base}/receipt?print=1`} target="_blank" rel="noopener" className={primaryButton}>
              <Printer className="size-4" aria-hidden /> Print receipt
            </a>
            <a href={`${base}/invoice`} target="_blank" rel="noopener" className={secondaryButton}>
              <FileText className="size-4" aria-hidden /> Tax invoice (A4)
            </a>
            <Link href={`${base}?customer=1`} scroll={false} className={secondaryButton}>
              <UserRound className="size-4" aria-hidden /> Customer details
            </Link>
            {canRefund && (
              <Link href={`${base}?refund=1`} scroll={false} className={`${secondaryButton} text-danger hover:bg-red-50`}>
                <Undo2 className="size-4" aria-hidden /> Return / refund
              </Link>
            )}
          </>
        }
      />
      {search.refunded && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Refund recorded. The goods are back in stock.
        </p>
      )}
      {sale.status !== "COMPLETED" && (
        <div className="mt-3">
          <Badge tone={sale.status === "REFUNDED" ? "red" : "amber"}>{SALE_STATUS[sale.status]}</Badge>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Product</th>
                <th className={`${thClass} text-right`}>Qty</th>
                <th className={`${thClass} text-right`}>Unit price</th>
                <th className={`${thClass} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sale.lines.map((l) => (
                <tr key={l.id}>
                  <td className={tdClass}>
                    <span className="font-medium text-navy">{l.name}</span> <span className="font-mono text-xs text-muted">{l.code}</span>
                    {l.refunded > 0 && <span className="block text-xs text-danger">{l.refunded} returned</span>}
                  </td>
                  <td className={`${tdClass} tabular text-right`}>{l.quantity}</td>
                  <td className={`${tdClass} tabular text-right`}>{formatMoney(withVat(l.unitPriceHT))}</td>
                  <td className={`${tdClass} tabular text-right font-medium`}>{formatMoney(withVat(l.lineTotalHT))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className={`${cardClass} p-5`}>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal excl. VAT</dt><dd className="tabular">{formatMoney(sale.subtotalHT)}</dd></div>
            {sale.discountHT > 0 && <div className="flex justify-between"><dt className="text-muted">Discount {sale.discountPct}%</dt><dd className="tabular">− {formatMoney(sale.discountHT)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">VAT 11%</dt><dd className="tabular">{formatMoney(sale.vatAmount)}</dd></div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-navy"><dt>Total</dt><dd className="tabular">{formatMoney(sale.totalTTC)}</dd></div>
            <div className="border-t border-border pt-2" />
            {sale.paidUsd > 0 && <div className="flex justify-between"><dt className="text-muted">Cash USD</dt><dd className="tabular">{formatMoney(sale.paidUsd)}</dd></div>}
            {sale.paidLbp > 0 && <div className="flex justify-between"><dt className="text-muted">Cash LBP</dt><dd className="tabular">{formatLbp(sale.paidLbp)}</dd></div>}
            {sale.paidCard > 0 && <div className="flex justify-between"><dt className="text-muted">Card</dt><dd className="tabular">{formatMoney(sale.paidCard)}</dd></div>}
            {sale.changeUsd > 0 && <div className="flex justify-between"><dt className="text-muted">Change given</dt><dd className="tabular">{formatMoney(sale.changeUsd)}</dd></div>}
            {sale.changeLbp > 0 && <div className="flex justify-between"><dt className="text-muted">Change given</dt><dd className="tabular">{formatLbp(sale.changeLbp)}</dd></div>}
            <p className="pt-1 text-xs text-muted">Rate {formatRate(sale.rate)}</p>
            {refunded > 0 && <div className="flex justify-between font-medium text-danger"><dt>Refunded</dt><dd className="tabular">− {formatMoney(refunded)}</dd></div>}
          </dl>
        </aside>
      </div>

      {sale.refunds.length > 0 && (
        <section className={`${cardClass} mt-6 overflow-x-auto`}>
          <h2 className="border-b border-border px-4 py-3 font-semibold text-navy">Returns</h2>
          <table className="w-full min-w-[40rem] text-sm">
            <tbody className="divide-y divide-border">
              {sale.refunds.map((r) => (
                <tr key={r.id}>
                  <td className={`${tdClass} font-mono text-xs text-navy`}>{r.number}</td>
                  <td className={`${tdClass} text-muted`}>{stamp.format(r.createdAt)} · {r.cashierName}</td>
                  <td className={tdClass}>{r.reason}</td>
                  <td className={`${tdClass} text-muted`}>{r.method === "CASH_LBP" ? formatLbp(r.amountLbp) : REFUND_METHODS[r.method]}</td>
                  <td className={`${tdClass} tabular text-right font-semibold`}>{formatMoney(r.totalTTC)}</td>
                  <td className={`${tdClass} text-right`}>
                    <a href={`${base}/receipt?print=1&refund=${r.id}`} target="_blank" rel="noopener" title="Print refund slip" aria-label="Print refund slip" className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy">
                      <Printer className="size-4" aria-hidden />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {search.refund && canRefund && (
        <Modal title={`Return goods · ${sale.number}`} closeHref={base} size="lg">
          <RefundForm
            key={crypto.randomUUID()}
            companySlug={slug}
            saleId={sale.id}
            lines={sale.lines.map((l) => ({ id: l.id, name: l.name, code: l.code, quantity: l.quantity, refunded: l.refunded, unitPriceHT: l.unitPriceHT }))}
            discountPct={sale.discountPct}
            maxRefund={round2(sale.totalTTC - refunded)}
            rate={sale.rate}
          />
        </Modal>
      )}
      {search.customer && (
        <Modal title="Customer on the tax invoice" closeHref={base} size="md">
          <SaleCustomerForm key={crypto.randomUUID()} companySlug={slug} saleId={sale.id} name={sale.customerName} address={sale.customerAddress} taxNumber={sale.customerTaxNumber} />
        </Modal>
      )}
    </>
  );
}

export default function SalePage({ params, searchParams }: PageProps<"/c/[company]/pos/sales/[saleId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <SaleDetail params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
