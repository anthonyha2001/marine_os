import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ExternalLink, FileDown, HandCoins, TicketCheck, Truck } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { deleteSupplierPayment } from "@/lib/actions/accounting";
import { deleteReceipt, deleteVoucher } from "@/lib/actions/finance";
import { PAYMENT_METHODS, billStatus } from "@/lib/accounting";
import { businessToday, dayFormat, dueInWords, isOverdue } from "@/lib/dates";
import { listBills } from "@/lib/data/accounting";
import { listCustomers } from "@/lib/data/sales";
import { getLedger, invoicesWithBalance, listMoneyAccounts, listVouchers } from "@/lib/data/ledger";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES, can, canAccessModule, isAdmin } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { InvoiceDialog, PurchaseDialog } from "@/components/document-dialogs";
import { Modal } from "@/components/modal";
import { OpenRow } from "@/components/open-row";
import { Badge, EmptyState, PageHeader, SearchBar, StatCard, cardClass, primaryButton, secondaryButton, tdClass, thClass } from "@/components/ui";
import { BillStatusBadge } from "../../accounting/bill-status";
import { LinkTabs } from "../finance-ui";
import { ReceiptForm } from "../receipts/receipt-form";
import { SupplierPaymentForm } from "./supplier-payment-form";
import { VoucherForm, type VoucherKind } from "./voucher-form";
import { CancelButton, CancelledNote } from "@/components/cancel-button";
import { cancelReceipt, cancelSupplierPayment, cancelVoucher } from "@/lib/actions/cancel";

type Search = { q?: string; new?: string; saved?: string; kind?: string; bill?: string; invoice?: string; viewBill?: string; viewInvoice?: string };

const CANCEL = { VOUCHER: cancelVoucher, SUPPLIER_PAYMENT: cancelSupplierPayment, RECEIPT: cancelReceipt };
const DELETE = { VOUCHER: deleteVoucher, SUPPLIER_PAYMENT: deleteSupplierPayment, RECEIPT: deleteReceipt };

const KIND: Record<VoucherKind, { label: string; title: string; tone: "red" | "green" | "blue" }> = {
  PAYMENT: { label: "Payment", title: "New payment voucher (PV)", tone: "red" },
  RECEIPT: { label: "Receipt", title: "New receipt voucher (RV)", tone: "green" },
  TRANSFER: { label: "Transfer", title: "New transfer", tone: "blue" },
};
const isKind = (k: string | undefined): k is VoucherKind => k === "PAYMENT" || k === "RECEIPT" || k === "TRANSFER";

async function VouchersContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, { q = "", new: creating, saved, kind, bill, invoice, viewBill, viewInvoice }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "accounting");
  const base = `/c/${slug}/finance/vouchers`;
  const [vouchers, allBills] = await Promise.all([listVouchers(slug), listBills(slug)]);
  const billsTab = kind === "BILLS";
  const admin = isAdmin(user);
  const mayCancel = can(user, "cancelEntries");
  const mayInvoices = canAccessModule(user, slug, "invoices"); // customer receipts need it to be cancelled or deleted
  const needle = q.trim().toLowerCase();
  const shown = vouchers.filter(
    (v) =>
      (!isKind(kind) || v.kind === kind) &&
      (!needle || [v.number, v.description, v.partyName ?? "", v.counterAccount, v.reference ?? ""].some((t) => t.toLowerCase().includes(needle))),
  );
  // Supplier bills still to pay, the next one due first.
  const openBills = allBills.filter((b) => b.balance > 0).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const shownBills = openBills.filter((b) => !needle || b.invoiceNumber.toLowerCase().includes(needle) || b.supplierName.toLowerCase().includes(needle));
  const overdueBills = openBills.filter((b) => isOverdue(b.dueDate));
  const month = businessToday().slice(0, 7);
  const sum = (k: VoucherKind) => round2(vouchers.filter((v) => v.kind === k && v.status === "POSTED" && v.date.toISOString().slice(0, 7) === month).reduce((s, v) => s + v.amount, 0));
  const savedVoucher = saved ? vouchers.find((v) => v.id === saved) : undefined;
  const keep = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, kind: isKind(kind) || billsTab ? kind : undefined, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Money`}
        title="Vouchers"
        description="All money in and out: payment vouchers for suppliers and expenses, receipt vouchers for customers and other income, and transfers between cash and bank."
        action={
          <>
            <Link href={keep({ new: "PAYMENT" })} scroll={false} className={primaryButton}>
              <ArrowUpRight className="size-4" aria-hidden /> Payment voucher
            </Link>
            <Link href={keep({ new: "SUPPLIER" })} scroll={false} className={secondaryButton}>
              <Truck className="size-4" aria-hidden /> Pay a supplier
            </Link>
            <Link href={keep({ new: "RECEIPT" })} scroll={false} className={secondaryButton}>
              <ArrowDownLeft className="size-4" aria-hidden /> Receipt voucher
            </Link>
            <Link href={keep({ new: "CUSTOMER" })} scroll={false} className={secondaryButton}>
              <HandCoins className="size-4" aria-hidden /> Customer payment
            </Link>
            <Link href={keep({ new: "TRANSFER" })} scroll={false} className={secondaryButton}>
              <ArrowLeftRight className="size-4" aria-hidden /> Transfer
            </Link>
          </>
        }
      />
      {savedVoucher && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          <span>
            {KIND[savedVoucher.kind].label} voucher <span className="font-mono font-semibold">{savedVoucher.number}</span> saved for {formatMoney(savedVoucher.amount)}.
          </span>
          <a href={`${base}/${savedVoucher.id}/pdf`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium hover:underline">
            <FileDown className="size-4" aria-hidden /> Print voucher
          </a>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Paid out this month" value={formatMoney(sum("PAYMENT"))} icon={ArrowUpRight} />
        <StatCard label="Received this month" value={formatMoney(sum("RECEIPT"))} icon={ArrowDownLeft} />
        <StatCard label="Transferred this month" value={formatMoney(sum("TRANSFER"))} icon={ArrowLeftRight} />
      </div>

      <div className="mt-6 space-y-4">
        <LinkTabs
          active={isKind(kind) || billsTab ? kind! : "ALL"}
          tabs={[
            { key: "ALL", label: `All (${vouchers.length})`, href: q ? `${base}?q=${encodeURIComponent(q)}` : base },
            ...(["PAYMENT", "RECEIPT", "TRANSFER"] as const).map((k) => ({
              key: k,
              label: `${KIND[k].label}s (${vouchers.filter((v) => v.kind === k).length})`,
              href: `${base}?kind=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
            })),
            { key: "BILLS", label: `Bills to pay (${openBills.length})`, href: `${base}?kind=BILLS${q ? `&q=${encodeURIComponent(q)}` : ""}` },
          ]}
        />
        <SearchBar action={base} defaultValue={q} placeholder={billsTab ? "Search by invoice number or supplier" : "Search by number, description, payee or account"} keep={{ kind: isKind(kind) || billsTab ? kind : undefined }} />
        {billsTab && (
          <p className="text-sm text-muted">
            To pay: <span className="font-semibold text-navy">{formatMoney(round2(openBills.reduce((s, b) => s + b.balance, 0)))}</span>
            {" · "}
            Overdue: <span className={`font-semibold ${overdueBills.length ? "text-danger" : "text-navy"}`}>{formatMoney(round2(overdueBills.reduce((s, b) => s + b.balance, 0)))}</span>
            {" · "}Double-click a bill to see what&apos;s inside.
          </p>
        )}
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {billsTab ? (
          shownBills.length === 0 ? (
            <EmptyState icon={Truck} title={q ? "No bills match this search" : "Nothing to pay"} description="All supplier bills are settled." />
          ) : (
            <table className="w-full min-w-[64rem] text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Supplier invoice</th>
                  <th className={thClass}>Supplier</th>
                  <th className={thClass}>Invoice date</th>
                  <th className={thClass}>Due</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Total</th>
                  <th className={`${thClass} text-right`}>Paid</th>
                  <th className={`${thClass} text-right`}>Left to pay</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shownBills.map((b) => (
                  <OpenRow key={b.id} href={keep({ viewBill: b.id })} className="hover:bg-surface-2/60">
                    <td className={`${tdClass} font-mono text-xs font-medium text-navy`}>{b.invoiceNumber}</td>
                    <td className={`${tdClass} font-medium text-navy`}>{b.supplierName}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{dayFormat.format(b.purchaseDate)}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {dayFormat.format(b.dueDate)}
                      <span className={`block text-xs ${isOverdue(b.dueDate) ? "font-medium text-danger" : "text-muted"}`}>{dueInWords(b.dueDate)}</span>
                    </td>
                    <td className={tdClass}>
                      <BillStatusBadge status={billStatus(b.total, b.paid, b.dueDate)} />
                    </td>
                    <td className={`${tdClass} tabular text-right`}>{formatMoney(b.total)}</td>
                    <td className={`${tdClass} tabular text-right text-muted`}>{formatMoney(b.paid)}</td>
                    <td className={`${tdClass} tabular text-right font-semibold`}>{formatMoney(b.balance)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      <Link href={keep({ new: "SUPPLIER", bill: b.id })} scroll={false} className={secondaryButton}>
                        Pay (PV)
                      </Link>
                    </td>
                  </OpenRow>
                ))}
              </tbody>
            </table>
          )
        ) : shown.length === 0 ? (
          <EmptyState icon={TicketCheck} title={q ? "No vouchers match this search" : "No vouchers yet"} description="Pay rent, salaries, fuel or any expense with a payment voucher." />
        ) : (
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Voucher</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Description</th>
                <th className={thClass}>Account</th>
                <th className={thClass}>Cash / bank</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((v) => (
                <OpenRow key={v.id} href={v.purchaseId ? keep({ viewBill: v.purchaseId }) : v.invoiceId ? keep({ viewInvoice: v.invoiceId }) : undefined} className="hover:bg-surface-2/60">
                  <td className={tdClass}>
                    <span className="block font-mono text-xs font-medium text-navy">{v.number}</span>
                    {v.status === "CANCELLED" ? <Badge tone="red">Cancelled</Badge> : <Badge tone={KIND[v.kind].tone}>{KIND[v.kind].label}</Badge>}
                    {v.status === "CANCELLED" && <CancelledNote by={v.cancelledByName} reason={v.cancelReason} />}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>{dayFormat.format(v.date)}</td>
                  <td className={tdClass}>
                    <span className="font-medium text-navy">{v.description}</span>
                    {v.partyName && <span className="block text-xs text-muted">{v.kind === "PAYMENT" ? "Paid to" : "From"} {v.partyName}</span>}
                  </td>
                  <td className={`${tdClass} text-muted`}>{v.counterAccount}</td>
                  <td className={`${tdClass} text-muted`}>
                    {v.moneyAccount}
                    <span className="block text-xs">
                      {PAYMENT_METHODS[v.method as keyof typeof PAYMENT_METHODS] ?? v.method}
                      {v.reference && ` · ${v.reference}`}
                    </span>
                  </td>
                  <td className={`${tdClass} tabular text-right font-semibold ${v.kind === "PAYMENT" ? "text-danger" : v.kind === "RECEIPT" ? "text-success" : ""}`}>
                    {v.kind === "PAYMENT" ? "−" : v.kind === "RECEIPT" ? "+" : ""}
                    {formatMoney(v.amount)}
                    {v.vatAmount > 0 && <span className="block text-xs font-normal text-muted">incl. VAT {formatMoney(v.vatAmount)}</span>}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    <a
                      href={`${base}/${v.id}/pdf`}
                      target="_blank"
                      rel="noopener"
                      title="Print voucher"
                      aria-label="Print voucher"
                      className="mr-1 inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy"
                    >
                      <FileDown className="size-4" aria-hidden />
                    </a>
                    {v.status === "POSTED" && mayCancel && (v.source !== "RECEIPT" || mayInvoices) && (
                      <CancelButton
                        action={CANCEL[v.source].bind(null, slug, v.id)}
                        title="Cancel voucher"
                        message={`Voucher ${v.number} of ${formatMoney(v.amount)} stays on record as cancelled, and a reversing entry is posted today.`}
                      />
                    )}
                    {(v.purchaseId || v.invoiceId) && (
                      <Link
                        href={v.purchaseId ? `/c/${slug}/purchases/${v.purchaseId}` : `/c/${slug}/invoices/${v.invoiceId}`}
                        title={v.purchaseId ? "Open the supplier bill" : "Open the invoice"}
                        aria-label={v.purchaseId ? "Open the supplier bill" : "Open the invoice"}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy"
                      >
                        <ExternalLink className="size-4" aria-hidden />
                      </Link>
                    )}
                    {admin && (
                      <DeleteButton
                        action={DELETE[v.source].bind(null, slug, v.id)}
                        confirmText={`Delete voucher ${v.number} of ${formatMoney(v.amount)}? It goes to the recycle bin with its accounting entry, and can be restored.`}
                        title="Delete voucher"
                        successMessage="Voucher moved to the recycle bin."
                      />
                    )}
                  </td>
                </OpenRow>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isKind(creating) && (
        <Modal title={KIND[creating].title} closeHref={keep({})} size="md">
          <NewVoucher slug={slug} kind={creating} />
        </Modal>
      )}
      {viewBill && <PurchaseDialog slug={slug} id={viewBill} closeHref={keep({})} canPay canOpen={canAccessModule(user, slug, "purchases")} />}
      {viewInvoice && <InvoiceDialog slug={slug} id={viewInvoice} closeHref={keep({})} canReceive canOpen={mayInvoices} />}
      {creating === "SUPPLIER" && (
        <Modal title="Pay a supplier (PV)" closeHref={keep({})} size="md">
          <NewSupplierPayment slug={slug} billId={bill} />
        </Modal>
      )}
      {creating === "CUSTOMER" && (
        <Modal title="Customer payment (RV)" closeHref={keep({})} size="md">
          <NewCustomerPayment slug={slug} invoiceId={invoice} />
        </Modal>
      )}
    </>
  );
}

async function NewVoucher({ slug, kind }: { slug: Parameters<typeof getLedger>[0]; kind: VoucherKind }) {
  const [ledger, moneyAccounts] = await Promise.all([getLedger(slug), listMoneyAccounts(slug)]);
  const counterAccounts = ledger.accounts
    .filter((a) => a.active && !["CASH", "BANK", "RECEIVABLE", "PAYABLE"].includes(a.kind))
    .map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }));
  return <VoucherForm key={crypto.randomUUID()} companySlug={slug} kind={kind} moneyAccounts={moneyAccounts} counterAccounts={counterAccounts} />;
}

async function NewSupplierPayment({ slug, billId }: { slug: Parameters<typeof getLedger>[0]; billId?: string }) {
  const [bills, accounts] = await Promise.all([listBills(slug), listMoneyAccounts(slug)]);
  const open = bills
    .filter((b) => b.balance > 0)
    .map((b) => ({ id: b.id, supplierId: b.supplierId, supplierName: b.supplierName, invoiceNumber: b.invoiceNumber, dueDate: b.dueDate.toISOString(), total: b.total, balance: b.balance }));
  return <SupplierPaymentForm key={crypto.randomUUID()} companySlug={slug} bills={open} accounts={accounts} defaultBillId={billId} />;
}

async function NewCustomerPayment({ slug, invoiceId }: { slug: Parameters<typeof getLedger>[0]; invoiceId?: string }) {
  const [open, accounts, customers] = await Promise.all([invoicesWithBalance(slug), listMoneyAccounts(slug), listCustomers()]);
  return (
    <ReceiptForm
      key={crypto.randomUUID()}
      companySlug={slug}
      accounts={accounts}
      invoices={open.filter((i) => i.balance > 0).map((i) => ({ id: i.id, number: i.number, customerName: i.customerName, totalTTC: i.totalTTC, balance: i.balance }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      defaultInvoiceId={invoiceId}
    />
  );
}

export default function VouchersPage({ params, searchParams }: PageProps<"/c/[company]/finance/vouchers">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading vouchers…</p>}>
      <VouchersContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
