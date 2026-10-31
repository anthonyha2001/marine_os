"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { savePurchaseOrder, type PurchaseOrderFormState } from "@/lib/actions/purchase-orders";
import { formatMoney, purchaseTotals } from "@/lib/money";
import { OrderLinesTable, OrderTotals, useOrderLines, type CatalogueItem, type InitialRow } from "@/components/order-lines";
import { QuickProductModal } from "@/components/quick-product-modal";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButton, StickyActions } from "@/components/ui";

export const DEFAULT_PO_TERMS = [
  "Please confirm receipt of this order, the price and the delivery date.",
  "Please quote our purchase order number on your delivery note and invoice.",
  "Goods must be delivered with their certificates of conformity where applicable.",
].join("\n");

export type PurchaseOrderValue = {
  id: string;
  supplierId: string;
  orderDate: string;
  expectedDate: string | null;
  status: "DRAFT" | "SENT";
  reference: string | null;
  terms: string | null;
  notes: string | null;
  discount: number;
  rows: InitialRow[];
};

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function PurchaseOrderForm({
  companySlug,
  companyName,
  suppliers,
  catalogue,
  order,
}: {
  companySlug: string;
  companyName: string;
  suppliers: { id: string; name: string }[];
  catalogue: CatalogueItem[];
  order?: PurchaseOrderValue;
}) {
  const [header, setHeader] = useState({
    supplierId: order?.supplierId ?? "",
    orderDate: order?.orderDate ?? today(),
    expectedDate: order?.expectedDate ?? today(),
    status: order?.status ?? ("DRAFT" as "DRAFT" | "SENT"),
    reference: order?.reference ?? "",
    terms: order?.terms ?? DEFAULT_PO_TERMS,
    notes: order?.notes ?? "",
    discount: order?.discount ? String(order.discount) : "",
  });
  const [dirty, setDirty] = useState(false);
  const [lines, searchInput] = useOrderLines(catalogue, order?.rows);
  const [creating, setCreating] = useState<string | null>(null);
  const [loadedMessage, setLoadedMessage] = useState("");
  const supplierSelect = useFocusOnShow<HTMLSelectElement>(!order);

  const set = <K extends keyof typeof header>(key: K, value: (typeof header)[K]) => {
    setHeader((h) => ({ ...h, [key]: value }));
    setDirty(true);
  };
  const isDirty = dirty || (!order && lines.rows.length > 0);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const totals = purchaseTotals(lines.numeric, Number(header.discount) || 0);

  const [state, formAction, pending] = useActionState<PurchaseOrderFormState, FormData>(async (prev) => {
    const payload = {
      ...header,
      discount: Number(header.discount) || 0,
      items: lines.payloadItems(),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    return savePurchaseOrder(companySlug, order?.id ?? null, prev, fd);
  }, {});

  return (
    <>
      <form
        action={formAction}
        data-save-shortcut
        data-dirty={isDirty}
        onInput={() => setDirty(true)}
        onKeyDown={(e) => {
          // Enter in a single-line field (e.g. a scanner) must not submit the whole order.
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
        }}
        className="mt-6 space-y-6"
      >
        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className={`${labelClass} sm:col-span-2`}>
            Supplier *
            <select
              ref={supplierSelect}
              required
              value={header.supplierId}
              onChange={(e) => set("supplierId", e.target.value)}
              className={inputClass}
            >
              <option value="">Choose a supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Order date *
            <input type="date" required value={header.orderDate} onChange={(e) => set("orderDate", e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Expected delivery
            <input type="date" value={header.expectedDate} onChange={(e) => set("expectedDate", e.target.value)} className={inputClass} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Reference
            <input
              value={header.reference}
              onChange={(e) => set("reference", e.target.value)}
              placeholder="Supplier quotation, project, vessel…"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Status
            <select value={header.status} onChange={(e) => set("status", e.target.value as "DRAFT" | "SENT")} className={inputClass}>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent to supplier</option>
            </select>
          </label>
          <label className={labelClass}>
            Discount (excl. VAT)
            <input
              type="number"
              min="0"
              step="0.01"
              value={header.discount}
              onChange={(e) => set("discount", e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </label>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-4">Ordered by {companyName}. The company is set automatically.</p>
        </section>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-4 py-3 text-sm">
          <button
            type="button"
            disabled={!header.supplierId}
            onClick={() => {
              const added = lines.addSupplierProducts(header.supplierId);
              setDirty(true);
              const supplier = suppliers.find((s) => s.id === header.supplierId)?.name ?? "this supplier";
              setLoadedMessage(added ? `Added ${added} product${added === 1 ? "" : "s"} from ${supplier} at quantity 0.` : `No more products from ${supplier} to add.`);
            }}
            className={`${secondaryButton} disabled:opacity-50`}
          >
            Load all products from this supplier
          </button>
          <span className="text-muted">
            {loadedMessage || (header.supplierId ? "Fill in the quantities you need." : "Choose a supplier first.")} Lines left at 0
            are removed when you save.
          </span>
        </div>

        <OrderLinesTable lines={lines} searchInput={searchInput} allowZero onCreateProduct={(name) => setCreating(name)} />

        <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <label className={`${labelClass} block`}>
              Terms for the supplier (one per line, printed on the PDF)
              <textarea rows={4} value={header.terms} onChange={(e) => set("terms", e.target.value)} className={inputClass} />
            </label>
            <label className={`${labelClass} block`}>
              Internal notes (never printed)
              <textarea rows={2} value={header.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} />
            </label>
          </div>
          <div className="h-fit rounded-2xl border border-border bg-surface p-5 text-sm">
            <OrderTotals totals={totals} />
            <div className="mt-4">
              <FormMessage error={state.error} />
            </div>
          </div>
        </section>

        <StickyActions
          summary={
            <span>
              {lines.numeric.filter((l) => l.quantity > 0).length} line(s) · Order total{" "}
              <span className="tabular text-base font-semibold text-navy">{formatMoney(totals.totalTTC)}</span>
            </span>
          }
        >
          <Link href={`/c/${companySlug}/purchase-orders`} className={secondaryButton}>
            Cancel
          </Link>
          <button type="submit" disabled={pending || !lines.numeric.some((l) => l.quantity > 0)} className={primaryButton}>
            {pending ? "Saving…" : order ? "Save changes" : "Save purchase order"}
            <Kbd className="border-white/20 bg-white/10 text-white/80">Ctrl S</Kbd>
          </button>
        </StickyActions>
      </form>

      {/* Outside the order form: it has its own form, and Enter must work in it. */}
      {creating !== null && (
        <QuickProductModal
          companySlug={companySlug}
          defaultName={creating}
          defaultSupplierId={header.supplierId}
          suppliers={suppliers}
          onClose={() => {
            setCreating(null);
            searchInput.current?.focus();
          }}
          onCreated={(product) => {
            setCreating(null);
            setDirty(true);
            lines.addCreated(product);
          }}
        />
      )}
    </>
  );
}
