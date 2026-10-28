import { Suspense } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { invoiceSettlements } from "@/lib/data/ledger";
import { listInvoices, listOffers } from "@/lib/data/sales";
import { formatMoney, round2 } from "@/lib/money";
import { Modal } from "@/components/modal";
import { COMPANIES } from "@/lib/permissions";
import { cardClass, PageHeader, ButtonLink, ProgressBar, SearchBar } from "@/components/ui";
import { CustomInvoiceForm } from "./custom-invoice-form";
import { InvoiceStatusBadge } from "./status-badge";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

async function InvoicesContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ q?: string; new?: string }>;
}) {
  const [{ company }, { q = "", new: creating }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "invoices");
  const needle = q.trim().toLowerCase();
  const [raw, offers, settled] = await Promise.all([listInvoices(slug), creating ? listOffers(slug) : [], invoiceSettlements(slug)]);
  const all = raw.map((i) => {
    const s = settled.get(i.id) ?? { paid: 0, credited: 0 };
    const done = round2(s.paid + s.credited);
    return { ...i, settled: done, balance: i.status === "CANCELLED" ? 0 : Math.max(0, round2(i.totalTTC - done)) };
  });
  const invoices = all.filter(
    (i) =>
      !needle ||
      i.number.toLowerCase().includes(needle) ||
      i.customerName.toLowerCase().includes(needle) ||
      (i.offer?.number ?? "").toLowerCase().includes(needle),
  );
  const today = new Date().toISOString().slice(0, 10);
  const open = all.filter((i) => i.balance > 0);
  const overdue = open.filter((i) => i.dueDate.toISOString().slice(0, 10) < today);
  const base = `/c/${slug}/invoices`;

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Invoices"
        description="Created from offers: one per scheduled payment, or a custom amount."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New invoice</ButtonLink>}
      />

      {creating && (
        <Modal title="New invoice" closeHref={base} size="md">
          <CustomInvoiceForm
            key={crypto.randomUUID()}
            companySlug={slug}
            returnTo="invoice"
            offers={offers
              .filter((o) => o.status !== "REJECTED" && round2(o.totalTTC - o.invoicedTTC) > 0)
              .map((o) => ({
                id: o.id,
                number: o.number,
                customerName: o.customerName,
                subject: o.subject,
                totalHT: o.totalHT,
                totalTTC: o.totalTTC,
                remaining: round2(o.totalTTC - o.invoicedTTC),
              }))}
          />
        </Modal>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Unpaid", formatMoney(open.reduce((sum, i) => sum + i.balance, 0)), `${open.length} invoices`],
          ["Overdue", formatMoney(overdue.reduce((sum, i) => sum + i.balance, 0)), `${overdue.length} invoices`],
          ["Invoices issued", String(all.filter((i) => i.status !== "CANCELLED").length), "excluding cancelled"],
        ].map(([label, value, hint]) => (
          <div key={label} className={`${cardClass} p-4`}>
            <p className="text-sm text-muted">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${label === "Overdue" && overdue.length ? "text-danger" : "text-navy"}`}>{value}</p>
            <p className="text-xs text-muted">{hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <SearchBar action={base} defaultValue={q} placeholder="Search by invoice number, customer or offer" />
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {invoices.length === 0 ? (
          <p className="p-10 text-center text-muted">
            {q ? "No invoices match this search." : "No invoices yet. Create them from an offer's Invoicing panel."}
          </p>
        ) : (
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Offer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Balance due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((i) => (
                <tr key={i.id} className={`hover:bg-background/60 ${i.status === "CANCELLED" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <Link href={`${base}/${i.id}`} className="font-mono font-medium text-brand hover:underline">
                      {i.number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{dateFormat.format(i.invoiceDate)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{dateFormat.format(i.dueDate)}</td>
                  <td className="px-4 py-3 font-medium text-navy">{i.customerName}</td>
                  <td className="px-4 py-3">
                    {i.offer ? (
                      <Link href={`/c/${slug}/offers/${i.offer.id}`} className="font-mono text-xs text-muted hover:underline">
                        {i.offer.number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={i.status} dueDate={i.dueDate} partial={i.settled > 0} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(i.totalTTC)}
                    {i.status !== "CANCELLED" && <ProgressBar value={i.totalTTC > 0 ? i.settled / i.totalTTC : 1} label="Settled" className="mt-1 min-w-24" />}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{i.status === "CANCELLED" ? "—" : formatMoney(i.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function InvoicesPage({ params, searchParams }: PageProps<"/c/[company]/invoices">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading invoices…</p>}>
      <InvoicesContent params={params} searchParams={searchParams as Promise<{ q?: string; new?: string }>} />
    </Suspense>
  );
}
