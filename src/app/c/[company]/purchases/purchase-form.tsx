"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createPurchase, type PurchaseFormState } from "@/lib/actions/purchases";
import { formatMoney, purchaseTotals } from "@/lib/money";
import { OrderLinesTable, OrderTotals, useOrderLines, type CatalogueItem, type InitialRow } from "@/components/order-lines";
import { QuickProductModal } from "@/components/quick-product-modal";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButton, StickyActions } from "@/components/ui";

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Pre-filled values when receiving a purchase order. */
export type PurchaseFromOrder = {
  purchaseOrderId: string;
  number: string;
  supplierId: string;
  discount: number;
  rows: InitialRow[];
};

export function PurchaseForm({
  companySlug,
  companyName,
  suppliers,
  catalogue,
  fromOrder,
  returnTo,
}: {
  companySlug: string;
  companyName: string;
  suppliers: { id: string; name: string }[];
  catalogue: CatalogueItem[];
  fromOrder?: PurchaseFromOrder;
  returnTo?: string; // opened in a pop-up: come back to this page after saving
}) {
  const [header, setHeader] = useState({
    supplierId: fromOrder?.supplierId ?? "",
    invoiceNumber: "",
    reference: fromOrder?.number ?? "",
    purchaseDate: today(),
    dueDate: today(),
    discount: fromOrder?.discount ? String(fromOrder.discount) : "",
    notes: "",
  });
  const [lines, searchInput] = useOrderLines(catalogue, fromOrder?.rows);
  const [creating, setCreating] = useState<string | null>(null);

  const dirty = lines.rows.length > 0 || header.invoiceNumber !== "";

  // Warn before closing the tab or reloading with an unsaved purchase.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const totals = purchaseTotals(lines.numeric, Number(header.discount) || 0);

  const [state, formAction, pending] = useActionState<PurchaseFormState, FormData>(async (prev) => {
    const payload = {
      supplierId: header.supplierId,
      invoiceNumber: header.invoiceNumber,
      reference: header.reference || undefined,
      purchaseDate: header.purchaseDate,
      dueDate: header.dueDate,
      discount: Number(header.discount) || 0,
      notes: header.notes || undefined,
      purchaseOrderId: fromOrder?.purchaseOrderId,
      items: lines.payloadItems(),
    };
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    if (returnTo) formData.set("returnTo", returnTo);
    return createPurchase(companySlug, prev, formData);
  }, {});

  return (
    <>
      <form
        action={formAction}
        data-save-shortcut
        data-dirty={dirty}
        // Stop Enter (e.g. a scanner in the wrong field) from submitting the whole purchase.
        // Enter moves to the next field (components/enter-keys.tsx) but never posts the document.
        data-enter-no-submit
        className="mt-6 space-y-6"
      >
        {fromOrder && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-brand">
            Receiving purchase order <span className="font-mono font-semibold">{fromOrder.number}</span>. Adjust quantities or
            prices if the delivery differs, enter the supplier&apos;s invoice number, and save to add the stock.
          </p>
        )}

        {/* Header */}
        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className={`${labelClass} sm:col-span-2`}>
            Supplier *
            <select
              required
              value={header.supplierId}
              onChange={(e) => setHeader({ ...header, supplierId: e.target.value })}
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
            Invoice number *
            <input
              required
              value={header.invoiceNumber}
              onChange={(e) => setHeader({ ...header, invoiceNumber: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Invoice date *
            <input
              type="date"
              required
              value={header.purchaseDate}
              onChange={(e) => setHeader({ ...header, purchaseDate: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Payment due
            <input
              type="date"
              value={header.dueDate}
              min={header.purchaseDate}
              onChange={(e) => setHeader({ ...header, dueDate: e.target.value })}
              className={inputClass}
            />
            <span className="mt-0.5 block text-xs font-normal text-muted">Empty = due on the invoice date</span>
          </label>
          <label className={labelClass}>
            Reference
            <input
              value={header.reference}
              onChange={(e) => setHeader({ ...header, reference: e.target.value })}
              placeholder="PO number, shipment, etc."
              className={inputClass}
            />
          </label>
          <div>
            <p className={labelClass}>Company</p>
            <p className="mt-1 rounded-lg bg-background px-3 py-2 text-sm font-medium text-navy">{companyName}</p>
          </div>
          <label className={labelClass}>
            Discount (excl. VAT)
            <input
              type="number"
              min="0"
              step="0.01"
              value={header.discount}
              onChange={(e) => setHeader({ ...header, discount: e.target.value })}
              placeholder="0.00"
              className={inputClass}
            />
          </label>
        </section>

        <OrderLinesTable lines={lines} searchInput={searchInput} onCreateProduct={(name) => setCreating(name)} />

        {/* Notes + totals */}
        <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <label className={labelClass}>
            Notes
            <textarea
              rows={4}
              value={header.notes}
              onChange={(e) => setHeader({ ...header, notes: e.target.value })}
              className={inputClass}
            />
          </label>

          <div className="rounded-2xl border border-border bg-surface p-5 text-sm">
            <OrderTotals totals={totals} />
            <div className="mt-4">
              <FormMessage error={state.error} />
            </div>
          </div>
        </section>

        <StickyActions
          summary={
            <span>
              {lines.rows.length} line(s) · Total{" "}
              <span className="tabular text-base font-semibold text-navy">{formatMoney(totals.totalTTC)}</span>
            </span>
          }
        >
          <Link
            href={returnTo ?? (fromOrder ? `/c/${companySlug}/purchase-orders/${fromOrder.purchaseOrderId}` : `/c/${companySlug}/purchases`)}
            scroll={!returnTo}
            className={secondaryButton}
          >
            Cancel
          </Link>
          <button type="submit" disabled={pending || lines.rows.length === 0} className={primaryButton}>
            {pending ? "Saving…" : fromOrder ? "Receive and add to stock" : "Save purchase"}
            <Kbd className="border-white/20 bg-white/10 text-white/80">Ctrl S</Kbd>
          </button>
        </StickyActions>
      </form>

      {/* Outside the purchase form: it has its own form, and Enter must work in it. */}
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
            lines.addCreated(product);
          }}
        />
      )}
    </>
  );
}
