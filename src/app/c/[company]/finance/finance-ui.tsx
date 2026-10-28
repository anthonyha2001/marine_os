import Link from "next/link";
import { businessToday, parseDay, parseDayEnd } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { inputClass, secondaryButton } from "@/components/ui";

// Small pieces shared by the finance pages.

export type PeriodParams = { from?: string; to?: string };

/** Period from ?from=&to= (YYYY-MM-DD). Defaults to 1 January of this year → today. */
export function periodFrom(params: PeriodParams) {
  const today = businessToday();
  const fromStr = params.from ?? `${today.slice(0, 4)}-01-01`;
  const toStr = params.to ?? today;
  return { fromStr, toStr, period: { from: parseDay(fromStr), to: parseDayEnd(toStr) } };
}

/** GET form with a date range; `keep` carries the page's other filters. */
export function PeriodFilter({
  action,
  from,
  to,
  keep = {},
  children,
}: {
  action: string;
  from: string;
  to: string;
  keep?: Record<string, string | undefined>;
  children?: React.ReactNode;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {children}
      <label className="text-xs font-medium text-muted">
        From
        <input type="date" name="from" defaultValue={from} className={`${inputClass} mt-1 h-9 w-40`} />
      </label>
      <label className="text-xs font-medium text-muted">
        To
        <input type="date" name="to" defaultValue={to} className={`${inputClass} mt-1 h-9 w-40`} />
      </label>
      <button type="submit" className={`${secondaryButton} h-9`}>
        Apply
      </button>
    </form>
  );
}

/** Right-aligned amount; blank for zero when `blankZero`. */
export function Amount({ value, blankZero = false, strong = false }: { value: number; blankZero?: boolean; strong?: boolean }) {
  if (blankZero && Math.abs(value) < 0.005) return <span className="text-slate-300">—</span>;
  return <span className={`tabular ${strong ? "font-semibold text-navy" : ""} ${value < 0 ? "text-danger" : ""}`}>{formatMoney(value)}</span>;
}

/** Tabs rendered as links (keeps state in the URL). */
export function LinkTabs({ tabs, active }: { tabs: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Sections">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${t.key === active ? "border-brand text-navy" : "border-transparent text-muted hover:text-navy"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Link to the document behind a journal entry, when there is a page for it. */
export function sourceHref(slug: string, sourceType: string, sourceId: string | null, ctx: { purchaseByPayment?: Map<string, string> } = {}) {
  if (!sourceId) return null;
  switch (sourceType) {
    case "INVOICE":
      return `/c/${slug}/invoices/${sourceId}`;
    case "PURCHASE":
      return `/c/${slug}/purchases/${sourceId}`;
    case "CREDIT_NOTE":
      return `/c/${slug}/finance/credit-notes/${sourceId}`;
    case "POS_SALE":
      return `/c/${slug}/pos/sales/${sourceId}`;
    case "TRANSFER_OUT":
    case "TRANSFER_IN":
      return `/c/${slug}/inventory/transfers?t=${sourceId}`;
    case "PAYROLL":
      return `/c/${slug}/payroll/${sourceId}`;
    case "POS_SHIFT":
      return `/c/${slug}/pos/shifts/${sourceId}`;
    case "VOUCHER":
      return `/c/${slug}/finance/vouchers/${sourceId}/pdf`;
    case "SUPPLIER_PAYMENT": {
      const purchaseId = ctx.purchaseByPayment?.get(sourceId);
      return purchaseId ? `/c/${slug}/purchases/${purchaseId}` : null;
    }
    default:
      return null;
  }
}

export const SOURCE_LABELS: Record<string, string> = {
  INVOICE: "Invoice",
  CREDIT_NOTE: "Credit note",
  PURCHASE: "Purchase",
  SUPPLIER_PAYMENT: "Supplier payment",
  RECEIPT: "Customer receipt",
  VOUCHER: "Voucher",
  MANUAL: "Manual entry",
  REVERSAL: "Reversal",
  POS_SALE: "Counter sale",
  POS_REFUND: "Counter refund",
  POS_SHIFT: "Till difference",
  PAYROLL: "Payroll",
  CHEQUE: "Cheque cleared",
  TRANSFER_OUT: "Transfer to sister company",
  TRANSFER_IN: "Transfer from sister company",
};
