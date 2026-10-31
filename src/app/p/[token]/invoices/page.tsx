import { Suspense } from "react";
import { HandCoins, Landmark, Receipt, ScrollText } from "lucide-react";
import { businessToday, dayFormat } from "@/lib/dates";
import { portalCustomer, portalMoney } from "@/lib/data/portal";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Badge, cardClass, secondaryButtonSm } from "@/components/ui";
import { Card, Empty, PageHead } from "../_parts";

const METHOD: Record<string, string> = { CASH: "Cash", BANK: "Bank transfer", TRANSFER: "Bank transfer", CHEQUE: "Cheque", CARD: "Card" };

async function Money({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const { invoices, payments, companies } = await portalMoney(customer.id);
  const base = `/p/${token}`;
  const today = businessToday();
  const due = round2(invoices.reduce((s, i) => s + i.balance, 0));
  const overdue = round2(invoices.filter((i) => i.balance > 0 && i.dueDate.toISOString().slice(0, 10) < today).reduce((s, i) => s + i.balance, 0));
  const paidYear = round2(payments.filter((p) => p.receivedAt.toISOString().startsWith(today.slice(0, 4))).reduce((s, p) => s + p.amount, 0));
  const withInvoices = companies.filter((c) => invoices.some((i) => i.company === c.slug));
  const payable = companies.filter((c) => invoices.some((i) => i.company === c.slug && i.balance > 0));

  return (
    <>
      <PageHead title="Invoices & payments" sub="What you owe each company, what you paid, and your statements." />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ["To pay", formatMoney(due), due > 0 ? "across your open invoices" : "All paid", false],
            ["Overdue", formatMoney(overdue), overdue > 0 ? "past the due date" : "Nothing overdue", overdue > 0],
            [`Paid in ${today.slice(0, 4)}`, formatMoney(paidYear), `${payments.length} payment${payments.length === 1 ? "" : "s"} in all`, false],
          ] as [string, string, string, boolean][]
        ).map(([label, value, hint, alert]) => (
          <div key={label} className={`${cardClass} p-4`}>
            <p className="text-[13px] font-medium text-muted">{label}</p>
            <p className={`tabular mt-1 text-2xl font-semibold ${alert ? "text-danger" : "text-navy"}`}>{value}</p>
            <p className="text-xs text-muted">{hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Invoices" icon={Receipt}>
            {invoices.length === 0 ? (
              <Empty>No invoices yet.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {invoices.map((i) => {
                  const late = i.balance > 0 && i.dueDate.toISOString().slice(0, 10) < today;
                  return (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span>
                        <span className="block font-medium text-navy">{i.number}</span>
                        <span className="block text-xs text-muted">
                          {COMPANIES[i.company].name} · {dayFormat.format(i.invoiceDate)} · due {dayFormat.format(i.dueDate)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular">{formatMoney(i.totalTTC)}</span>
                        {i.balance > 0 ? <Badge tone={late ? "red" : "amber"}>{formatMoney(i.balance)} {late ? "overdue" : "due"}</Badge> : <Badge tone="green">Paid</Badge>}
                        <a href={`${base}/invoices/${i.id}/pdf`} target="_blank" rel="noopener" className={secondaryButtonSm}>
                          PDF
                        </a>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Payments we received" icon={HandCoins}>
            {payments.length === 0 ? (
              <Empty>No payment recorded yet.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      <span className="block font-medium text-navy">{dayFormat.format(p.receivedAt)}</span>
                      <span className="block text-xs text-muted">
                        {p.number} · {METHOD[p.method] ?? p.method} · {COMPANIES[p.company].name}
                        {p.invoice && ` · for ${p.invoice.number}`}
                      </span>
                    </span>
                    <span className="tabular font-semibold text-success">{formatMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {withInvoices.length > 0 && (
            <Card title="Statements of account" icon={ScrollText}>
              <ul className="divide-y divide-border">
                {withInvoices.map((c) => (
                  <li key={c.slug}>
                    <a href={`${base}/statement/${c.slug}`} target="_blank" rel="noopener" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-2">
                      <span className="font-medium text-navy">{c.name}</span>
                      <span className="text-xs font-medium text-brand">Open PDF</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="How to pay" icon={Landmark}>
            <div className="space-y-4 p-4 text-sm">
              {(payable.length ? payable : companies).map((c) => (
                <div key={c.slug}>
                  <p className="font-semibold text-navy">{c.legalName || c.name}</p>
                  {c.bankDetails ? <p className="mt-1 whitespace-pre-line text-slate-700">{c.bankDetails}</p> : <p className="mt-1 text-muted">Cash or cheque at our office.</p>}
                  {(c.phone || c.email) && <p className="mt-1 text-xs text-muted">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>}
                </div>
              ))}
              <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">Please write the invoice number as the reference of your transfer.</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function PortalInvoices({ params }: PageProps<"/p/[token]/invoices">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Money params={params} />
    </Suspense>
  );
}
