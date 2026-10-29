import { Suspense } from "react";
import { Coins, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { currentLbpRate } from "@/lib/lbp-rate";
import { canSetRate, formatRate } from "@/lib/pos";
import { LbpRateForm } from "./lbp-rate-form";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { invoiceSettlements } from "@/lib/data/ledger";
import { companyIdFor, getCatalogue } from "@/lib/data/inventory";
import { listCustomers, listInvoices, listOffers } from "@/lib/data/sales";
import { vesselOptions } from "@/lib/data/vessels";
import { formatMoney, round2 } from "@/lib/money";
import { Modal } from "@/components/modal";
import { COMPANIES } from "@/lib/permissions";
import { cardClass, PageHeader, ButtonLink, ProgressBar, SearchBar, secondaryButton } from "@/components/ui";
import { CustomInvoiceForm } from "./custom-invoice-form";
import { StandaloneInvoiceForm } from "./standalone-invoice-form";
import { LinkTabs } from "../finance/finance-ui";
import { InvoiceStatusBadge } from "./status-badge";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

async function InvoicesContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ q?: string; new?: string; rate?: string; rateSaved?: string }>;
}) {
  const [{ company }, { q = "", new: creating, rate: editingRate, rateSaved }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "invoices");
  const lbpRate = await currentLbpRate(prisma, await companyIdFor(slug));
  const mayRate = canSetRate(user.role);
  const needle = q.trim().toLowerCase();
  const custom = creating === "custom";
  const [raw, offers, settled, customers, vessels, catalogue] = await Promise.all([
    listInvoices(slug),
    creating && !custom ? listOffers(slug) : [],
    invoiceSettlements(slug),
    custom ? listCustomers() : [],
    custom ? vesselOptions() : [],
    custom ? getCatalogue() : [],
  ]);
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
        description="Three ways to invoice: from an offer (its payment plan), from a workshop job card, or a custom invoice with any lines."
        action={
          <>
            {mayRate ? (
              <Link href={`${base}?rate=1`} scroll={false} className={secondaryButton} title="Rate used to print the VAT in LBP on new invoices">
                <Coins className="size-4" aria-hidden /> {lbpRate ? formatRate(lbpRate) : "Set LBP rate"}
              </Link>
            ) : (
              lbpRate && (
                <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted">
                  <Coins className="size-4" aria-hidden /> {formatRate(lbpRate)}
                </span>
              )
            )}
            <ButtonLink icon={Plus} href={`${base}?new=1`}>New invoice</ButtonLink>
          </>
        }
      />
      {rateSaved && lbpRate && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Rate saved: {formatRate(lbpRate)}. New invoices print their VAT in LBP at this rate.
        </p>
      )}
      {!lbpRate && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No LBP rate yet: invoices can&apos;t show their VAT in Lebanese pounds. {mayRate ? "Set it with the rate button above." : "Ask a manager or the accountant to set it."}
        </p>
      )}
      {editingRate && mayRate && (
        <Modal title="LBP exchange rate" closeHref={base} size="md">
          <LbpRateForm key={crypto.randomUUID()} companySlug={slug} current={lbpRate} />
        </Modal>
      )}

      {creating && (
        <Modal title="New invoice" closeHref={base} size={custom ? "xl" : "md"}>
          <div className="mb-4">
            <LinkTabs
              active={custom ? "custom" : "offer"}
              tabs={[
                { key: "offer", label: "From an offer", href: `${base}?new=offer` },
                { key: "custom", label: "Custom invoice", href: `${base}?new=custom` },
              ]}
            />
          </div>
          {custom ? (
            <StandaloneInvoiceForm
              key={crypto.randomUUID()}
              companySlug={slug}
              customers={customers.map((c) => ({ id: c.id, name: c.name }))}
              vessels={vessels}
              catalogue={catalogue.filter((c) => c.active).map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type, priceHT: c.priceHT }))}
            />
          ) : (
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
          )}
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
      <InvoicesContent params={params} searchParams={searchParams as Promise<{ q?: string; new?: string; rate?: string; rateSaved?: string }>} />
    </Suspense>
  );
}
