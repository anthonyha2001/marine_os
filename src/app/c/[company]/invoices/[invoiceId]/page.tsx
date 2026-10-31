import { Suspense } from "react";
import { SendButton } from "@/components/send-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditNoteDialog } from "@/components/create-dialogs";
import { requireModule } from "@/lib/auth";
import { deleteReceipt } from "@/lib/actions/finance";
import { PAYMENT_METHODS } from "@/lib/accounting";
import { listCreditNotes, listReceipts } from "@/lib/data/ledger";
import { getInvoice } from "@/lib/data/sales";
import { formatMoney, round2, VAT_RATE } from "@/lib/money";
import { COMPANIES, can, canAccessModule, isAdmin } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { Badge, PageHeader, ProgressBar, cardClass } from "@/components/ui";
import { InvoiceStatusBadge } from "../status-badge";
import { InvoiceActions } from "./invoice-actions";
import { CancelButton, CancelledNote } from "@/components/cancel-button";
import { cancelReceipt } from "@/lib/actions/cancel";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

async function InvoiceDetail({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; invoiceId: string }>;
  searchParams: Promise<{ create?: string }>;
}) {
  const [{ company, invoiceId }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "invoices");
  const admin = isAdmin(user);
  const mayCancel = can(user, "cancelEntries");
  // Only finds invoices of this company, so another company's invoice can't be opened by URL.
  const invoice = await getInvoice(slug, invoiceId);
  if (!invoice) notFound();
  const [allReceipts, allNotes] = await Promise.all([listReceipts(slug), listCreditNotes(slug)]);
  const receipts = allReceipts.filter((r) => r.invoice?.id === invoice.id);
  const notes = allNotes.filter((c) => c.invoice?.id === invoice.id);
  const paid = round2(receipts.filter((r) => r.status === "POSTED").reduce((s, r) => s + r.amount, 0));
  const credited = round2(notes.filter((c) => c.status === "ISSUED").reduce((s, c) => s + c.totalTTC, 0));
  const balance = invoice.status === "CANCELLED" ? 0 : Math.max(0, round2(invoice.totalTTC - paid - credited));

  const facts: [string, React.ReactNode][] = [
    ["Customer", invoice.customerName],
    ["Invoice date", dateFormat.format(invoice.invoiceDate)],
    ["Due date", dateFormat.format(invoice.dueDate)],
    [
      "Offer",
      invoice.offer ? (
        <Link href={`/c/${slug}/offers/${invoice.offer.id}`} className="font-mono text-brand hover:underline">
          {invoice.offer.number}
        </Link>
      ) : (
        "—"
      ),
    ],
    ["Customer reference", invoice.reference ?? "—"],
    ["Paid on", invoice.paidAt ? dateFormat.format(invoice.paidAt) : "—"],
  ];

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Invoice`}
        title={invoice.number}
        description={invoice.subject ?? undefined}
        action={
          <div className="flex flex-wrap gap-2">
          {invoice.status !== "CANCELLED" && <SendButton companySlug={slug} kind="invoice" id={invoice.id} />}
          <InvoiceActions
            companySlug={slug}
            invoiceId={invoice.id}
            status={invoice.status}
            balance={balance}
            canReceive={canAccessModule(user, slug, "accounting")}
            creditable={round2(invoice.totalTTC - credited)}
            hasSettlements={receipts.length > 0 || notes.some((c) => c.status === "ISSUED")}
          />
          </div>
        }
      />
      <div className="mt-3">
        <InvoiceStatusBadge status={invoice.status} dueDate={invoice.dueDate} partial={paid + credited > 0} />
      </div>

      <dl className={`${cardClass} mt-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3`}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-navy">{value}</dd>
          </div>
        ))}
      </dl>

      <div className={`${cardClass} mt-6 overflow-x-auto`}>
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit price excl. VAT</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-navy">{l.title}</p>
                  {l.description && <p className="text-xs text-muted">{l.description}</p>}
                </td>
                <td className="px-4 py-3 text-right">{l.quantity}</td>
                <td className="px-4 py-3 text-right">{formatMoney(l.unitPrice)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <dl className={`${cardClass} w-full max-w-sm space-y-2 p-5 text-sm`}>
          <div className="flex justify-between"><dt>Total excl. VAT</dt><dd className="font-medium">{formatMoney(invoice.totalHT)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{invoice.applyVat ? `VAT ${VAT_RATE * 100}%` : "VAT"}</dt><dd>{invoice.applyVat ? formatMoney(invoice.vatAmount) : "Exempt"}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-navy"><dt>Total</dt><dd>{formatMoney(invoice.totalTTC)}</dd></div>
          {invoice.status !== "CANCELLED" && (
            <>
              {paid > 0 && <div className="flex justify-between text-muted"><dt>Paid</dt><dd>− {formatMoney(paid)}</dd></div>}
              {credited > 0 && <div className="flex justify-between text-muted"><dt>Credit notes</dt><dd>− {formatMoney(credited)}</dd></div>}
              <div className="flex justify-between font-semibold text-navy"><dt>Balance due</dt><dd>{formatMoney(balance)}</dd></div>
            </>
          )}
        </dl>
      </div>

      {invoice.status !== "CANCELLED" && (
        <section className={`${cardClass} mt-6 p-5`}>
          <h2 className="font-semibold text-navy">Payments & credit notes</h2>
          <p className="mt-1 text-sm text-muted">
            Settled {formatMoney(round2(paid + credited))} of {formatMoney(invoice.totalTTC)} ·{" "}
            <span className="font-semibold text-navy">{balance > 0 ? `${formatMoney(balance)} left to collect` : "fully settled"}</span>
          </p>
          <ProgressBar value={invoice.totalTTC > 0 ? (paid + credited) / invoice.totalTTC : 1} label="Settled" className="mt-2 max-w-sm" />
          {receipts.length + notes.length > 0 && (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2 pr-3">Document</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Details</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {receipts.map((r) => (
                  <tr key={r.id} className={r.status === "CANCELLED" ? "opacity-60" : ""}>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {r.number}
                      {r.status === "CANCELLED" && <CancelledNote by={r.cancelledByName} reason={r.cancelReason} />}
                    </td>
                    <td className="py-2 pr-3">{dateFormat.format(r.receivedAt)}</td>
                    <td className="py-2 pr-3 text-muted">
                      {PAYMENT_METHODS[r.method as keyof typeof PAYMENT_METHODS] ?? r.method} · {r.moneyAccount}
                      {r.reference && ` · ${r.reference}`}
                    </td>
                    <td className={`py-2 pr-3 text-right font-medium ${r.status === "CANCELLED" ? "line-through" : ""}`}>{formatMoney(r.amount)}</td>
                    <td className="whitespace-nowrap py-2 text-right">
                      {r.status === "POSTED" && mayCancel && (
                        <CancelButton
                          action={cancelReceipt.bind(null, slug, r.id)}
                          title="Cancel receipt"
                          message={`Receipt ${r.number} of ${formatMoney(r.amount)} stays on record as cancelled, a reversing entry is posted today, and the invoice balance goes back up.`}
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
                {notes.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-3">
                      <Link href={`/c/${slug}/finance/credit-notes/${c.id}`} className="font-mono text-xs text-brand hover:underline">
                        {c.number}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{dateFormat.format(c.date)}</td>
                    <td className="py-2 pr-3 text-muted">
                      Credit note · {c.reason} {c.status === "CANCELLED" && <Badge tone="gray">Cancelled</Badge>}
                    </td>
                    <td className={`py-2 pr-3 text-right font-medium ${c.status === "CANCELLED" ? "text-muted line-through" : ""}`}>{formatMoney(c.totalTTC)}</td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {search.create === "credit" && <CreditNoteDialog slug={slug} closeHref={`/c/${slug}/invoices/${invoiceId}`} invoiceId={invoiceId} />}
    </>
  );
}

export default function InvoicePage({ params, searchParams }: PageProps<"/c/[company]/invoices/[invoiceId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <InvoiceDetail params={params} searchParams={searchParams as Promise<{ create?: string }>} />
    </Suspense>
  );
}
