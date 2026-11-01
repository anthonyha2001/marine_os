"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { issueEditedInvoice, type CustomInvoiceState } from "@/lib/actions/invoices";
import { VAT_RATE, formatMoney, round2 } from "@/lib/money";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButtonSm } from "@/components/ui";

export type EditableInvoiceLine = { jobLineId?: string; productId?: string | null; title: string; description?: string | null; quantity: number; unitPrice: number; discountPercent: number };
export type InvoiceProduct = { id: string; code: string; name: string; priceHT: number };

// fixed: a line of the job card / offer itself; added lines must be picked from the catalogue.
type Row = { key: string; jobLineId?: string; productId: string | null; fixed: boolean; title: string; description: string; quantity: string; unitPrice: string; discountPercent: string };

const toRow = (l: EditableInvoiceLine, fixed = true): Row => ({
  key: crypto.randomUUID(),
  jobLineId: l.jobLineId,
  productId: l.productId ?? null,
  fixed,
  title: l.title,
  description: l.description ?? "",
  quantity: String(l.quantity),
  unitPrice: String(l.unitPrice),
  discountPercent: l.discountPercent ? String(l.discountPercent) : "",
});
const n = (v: string) => Number(v.replace(/,/g, "")) || 0;
const rowTotal = (r: Row) => round2(n(r.quantity) * n(r.unitPrice) * (1 - Math.min(Math.max(n(r.discountPercent), 0), 100) / 100));
const cell = `${inputClass} mt-0 py-1.5 text-sm`;

/**
 * Review an invoice before issuing it (from a job card or an offer): change quantities, prices
 * and the discount of each line, remove lines or add anything else.
 */
export function InvoiceEditor({
  companySlug,
  source,
  lines,
  applyVat: vatDefault,
  returnTo,
  products = [],
  intro,
}: {
  companySlug: string;
  source: { kind: "job" | "offer"; id: string };
  lines: EditableInvoiceLine[];
  applyVat: boolean;
  returnTo: string;
  products?: InvoiceProduct[];
  intro?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<CustomInvoiceState, FormData>(issueEditedInvoice.bind(null, companySlug), {});
  const [rows, setRows] = useState<Row[]>(() => (lines.length ? lines.map((l) => toRow(l)) : [toRow({ title: "", quantity: 1, unitPrice: 0, discountPercent: 0 }, false)]));
  const [applyVat, setApplyVat] = useState(vatDefault);
  const [dueDays, setDueDays] = useState("0");
  const [notes, setNotes] = useState("");
  const [allDiscount, setAllDiscount] = useState("");

  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const gross = round2(rows.reduce((s, r) => s + n(r.quantity) * n(r.unitPrice), 0));
  const totalHT = round2(rows.reduce((s, r) => s + rowTotal(r), 0));
  const vat = applyVat ? round2(totalHT * VAT_RATE) : 0;
  const filled = rows.filter((r) => r.title.trim() || n(r.unitPrice));
  const payload = JSON.stringify({
    source,
    applyVat,
    dueDays: Math.max(0, Math.round(n(dueDays))),
    notes,
    returnTo,
    lines: filled.map((r) => ({
      jobLineId: r.jobLineId,
      productId: r.productId,
      fixed: r.fixed,
      title: r.title,
      description: r.description || undefined,
      quantity: n(r.quantity),
      unitPrice: n(r.unitPrice),
      discountPercent: n(r.discountPercent),
    })),
  });

  return (
    <form action={formAction} data-save-shortcut data-enter-no-submit className="space-y-4">
      <input type="hidden" name="payload" value={payload} />
      {intro && <div className="rounded-lg bg-background p-3 text-sm">{intro}</div>}

      <div className="overflow-x-auto rounded-lg border border-border" data-no-row-keys>
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-border bg-background text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-2 py-2">Description</th>
              <th className="w-20 px-2 py-2 text-right">Qty</th>
              <th className="w-28 px-2 py-2 text-right">Unit price</th>
              <th className="w-20 px-2 py-2 text-right">Disc. %</th>
              <th className="w-28 px-2 py-2 text-right">Total</th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.key} className="align-top">
                <td className="px-2 py-1.5">
                  <input
                    value={r.title}
                    list={products.length ? "invoice-products" : undefined}
                    onChange={(e) => {
                      const title = e.target.value;
                      if (r.fixed) return set(r.key, { title });
                      const v = title.trim().toLowerCase();
                      const p = products.find((x) => x.name.toLowerCase() === v || x.code.toLowerCase() === v || `${x.code} · ${x.name}`.toLowerCase() === v);
                      set(r.key, p ? { title: p.name, productId: p.id, unitPrice: String(p.priceHT) } : { title, productId: null });
                    }}
                    placeholder={r.fixed ? "What is billed" : "Type a code or name and pick it"}
                    aria-label="Description"
                    aria-invalid={!r.fixed && !!r.title.trim() && !r.productId}
                    className={`${cell} ${!r.fixed && r.title.trim() && !r.productId ? "border-danger ring-2 ring-danger/15" : ""}`}
                  />
                  {!r.fixed && r.title.trim() && !r.productId && <p className="mt-0.5 text-xs text-danger">Not in the catalogue: pick it from the list.</p>}
                  <input value={r.description} onChange={(e) => set(r.key, { description: e.target.value })} placeholder="Details (optional)" aria-label="Details" className={`${cell} mt-1 text-xs text-muted`} />
                </td>
                <td className="px-2 py-1.5">
                  <input value={r.quantity} onChange={(e) => set(r.key, { quantity: e.target.value })} inputMode="decimal" aria-label="Quantity" className={`${cell} text-right`} />
                </td>
                <td className="px-2 py-1.5">
                  <input value={r.unitPrice} onChange={(e) => set(r.key, { unitPrice: e.target.value })} inputMode="decimal" aria-label="Unit price" className={`${cell} text-right`} />
                </td>
                <td className="px-2 py-1.5">
                  <input value={r.discountPercent} onChange={(e) => set(r.key, { discountPercent: e.target.value })} inputMode="decimal" placeholder="0" aria-label="Discount %" className={`${cell} text-right`} />
                </td>
                <td className="tabular px-2 py-3 text-right font-medium text-navy">{formatMoney(rowTotal(r))}</td>
                <td className="py-2">
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} disabled={rows.length === 1} className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-30" aria-label="Remove line" title="Remove line">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length > 0 && (
          <datalist id="invoice-products">
            {products.map((p) => (
              <option key={p.code} value={`${p.code} · ${p.name}`} />
            ))}
          </datalist>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setRows((rs) => [...rs, toRow({ title: "", quantity: 1, unitPrice: 0, discountPercent: 0 }, false)])} className={secondaryButtonSm}>
          <Plus className="size-3.5" aria-hidden /> Add item from the catalogue
        </button>
        <span className="ml-auto flex items-center gap-2 whitespace-nowrap text-sm text-muted">
          Discount on every line
          <input value={allDiscount} onChange={(e) => setAllDiscount(e.target.value)} inputMode="decimal" placeholder="%" aria-label="Discount on every line" className={`${cell} w-20 max-w-20 text-right`} />
          <button type="button" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, discountPercent: allDiscount })))} className={secondaryButtonSm}>
            Apply
          </button>
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Payment due in (days)
            <input value={dueDays} onChange={(e) => setDueDays(e.target.value)} type="number" min="0" max="365" className={inputClass} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-navy">
            <input type="checkbox" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} className="size-4" /> Add VAT ({Math.round(VAT_RATE * 100)}%)
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Note on the invoice
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Optional" />
          </label>
        </div>
        <dl className="tabular space-y-1 rounded-lg bg-background p-3 text-sm">
          {gross > totalHT && (
            <div className="flex justify-between text-muted">
              <dt>Discounts</dt>
              <dd>-{formatMoney(round2(gross - totalHT))}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Total excl. VAT</dt>
            <dd>{formatMoney(totalHT)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">VAT</dt>
            <dd>{formatMoney(vat)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-navy">
            <dt>Total</dt>
            <dd>{formatMoney(round2(totalHT + vat))}</dd>
          </div>
        </dl>
      </div>

      <FormMessage error={state.error} />
      <button type="submit" disabled={pending || !filled.length || filled.some((r) => !r.fixed && !r.productId)} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Creating…" : "Create invoice"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
