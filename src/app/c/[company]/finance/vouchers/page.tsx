import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, FileDown, TicketCheck } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { deleteVoucher } from "@/lib/actions/finance";
import { PAYMENT_METHODS } from "@/lib/accounting";
import { businessToday, dayFormat } from "@/lib/dates";
import { getLedger, listMoneyAccounts, listVouchers } from "@/lib/data/ledger";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { Modal } from "@/components/modal";
import { Badge, EmptyState, PageHeader, SearchBar, StatCard, cardClass, primaryButton, secondaryButton, tdClass, thClass } from "@/components/ui";
import { LinkTabs } from "../finance-ui";
import { VoucherForm, type VoucherKind } from "./voucher-form";

type Search = { q?: string; new?: string; saved?: string; kind?: string };

const KIND: Record<VoucherKind, { label: string; title: string; tone: "red" | "green" | "blue" }> = {
  PAYMENT: { label: "Payment", title: "New payment voucher (PV)", tone: "red" },
  RECEIPT: { label: "Receipt", title: "New receipt voucher (RV)", tone: "green" },
  TRANSFER: { label: "Transfer", title: "New transfer", tone: "blue" },
};
const isKind = (k: string | undefined): k is VoucherKind => k === "PAYMENT" || k === "RECEIPT" || k === "TRANSFER";

async function VouchersContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, { q = "", new: creating, saved, kind }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "accounting");
  const base = `/c/${slug}/finance/vouchers`;
  const vouchers = await listVouchers(slug);
  const needle = q.trim().toLowerCase();
  const shown = vouchers.filter(
    (v) =>
      (!isKind(kind) || v.kind === kind) &&
      (!needle || [v.number, v.description, v.partyName ?? "", v.counterAccount, v.reference ?? ""].some((t) => t.toLowerCase().includes(needle))),
  );
  const month = businessToday().slice(0, 7);
  const sum = (k: VoucherKind) => round2(vouchers.filter((v) => v.kind === k && v.date.toISOString().slice(0, 7) === month).reduce((s, v) => s + v.amount, 0));
  const savedVoucher = saved ? vouchers.find((v) => v.id === saved) : undefined;
  const keep = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, kind: isKind(kind) ? kind : undefined, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Finance`}
        title="Vouchers"
        description="Payment vouchers for expenses, receipt vouchers for money coming in, and transfers between cash and bank."
        action={
          <>
            <Link href={keep({ new: "PAYMENT" })} scroll={false} className={primaryButton}>
              <ArrowUpRight className="size-4" aria-hidden /> Payment voucher
            </Link>
            <Link href={keep({ new: "RECEIPT" })} scroll={false} className={secondaryButton}>
              <ArrowDownLeft className="size-4" aria-hidden /> Receipt voucher
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
        <StatCard label="Received this month" value={formatMoney(sum("RECEIPT"))} icon={ArrowDownLeft} hint="excluding customer receipts" />
        <StatCard label="Transferred this month" value={formatMoney(sum("TRANSFER"))} icon={ArrowLeftRight} />
      </div>

      <div className="mt-6 space-y-4">
        <LinkTabs
          active={isKind(kind) ? kind : "ALL"}
          tabs={[
            { key: "ALL", label: `All (${vouchers.length})`, href: q ? `${base}?q=${encodeURIComponent(q)}` : base },
            ...(["PAYMENT", "RECEIPT", "TRANSFER"] as const).map((k) => ({
              key: k,
              label: `${KIND[k].label}s (${vouchers.filter((v) => v.kind === k).length})`,
              href: `${base}?kind=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
            })),
          ]}
        />
        <SearchBar action={base} defaultValue={q} placeholder="Search by number, description, payee or account" keep={{ kind: isKind(kind) ? kind : undefined }} />
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {shown.length === 0 ? (
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
                <tr key={v.id} className="hover:bg-surface-2/60">
                  <td className={tdClass}>
                    <span className="block font-mono text-xs font-medium text-navy">{v.number}</span>
                    <Badge tone={KIND[v.kind].tone}>{KIND[v.kind].label}</Badge>
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
                    <DeleteButton
                      action={deleteVoucher.bind(null, slug, v.id)}
                      confirmText={`Delete voucher ${v.number} of ${formatMoney(v.amount)}? Its accounting entry is removed.`}
                      title="Delete voucher"
                      successMessage="Voucher deleted."
                    />
                  </td>
                </tr>
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

export default function VouchersPage({ params, searchParams }: PageProps<"/c/[company]/finance/vouchers">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading vouchers…</p>}>
      <VouchersContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
