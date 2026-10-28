"use client";

import { useActionState, useState } from "react";
import { createStandaloneInvoice, type CustomInvoiceState } from "@/lib/actions/invoices";
import type { VesselOption } from "@/lib/data/vessels";
import { VAT_RATE, formatMoney, round2 } from "@/lib/money";
import { FreeLinesEditor, lineAmount, newLine, type CatalogueItem, type FreeLine } from "@/components/free-lines";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

/** An invoice with no offer and no job card: pick or type the customer, then any lines. */
export function StandaloneInvoiceForm({
  companySlug,
  customers,
  vessels,
  catalogue,
}: {
  companySlug: string;
  customers: { id: string; name: string }[];
  vessels: VesselOption[];
  catalogue: CatalogueItem[];
}) {
  const [state, formAction, pending] = useActionState<CustomInvoiceState, FormData>(createStandaloneInvoice.bind(null, companySlug), {});
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<FreeLine[]>(() => [newLine()]);
  const [applyVat, setApplyVat] = useState(true);
  const first = useFocusOnShow<HTMLSelectElement>();
  const ht = round2(lines.reduce((s, l) => s + lineAmount(l), 0));
  const vat = applyVat ? round2(ht * VAT_RATE) : 0;
  const boats = vessels.filter((v) => !customerId || v.customerId === customerId);

  return (
    <form
      action={(fd) => {
        const f = (k: string) => String(fd.get(k) ?? "");
        fd.set(
          "payload",
          JSON.stringify({
            customerId: customerId || null,
            customerName: f("customerName"),
            customerAddress: f("customerAddress"),
            customerTaxNumber: f("customerTaxNumber"),
            vesselId: f("vesselId") || null,
            subject: f("subject"),
            reference: f("reference"),
            notes: f("notes"),
            applyVat,
            dueDays: Number(f("dueDays")) || 0,
            lines: lines
              .filter((l) => l.title.trim() || Number(l.unitPrice))
              .map((l) => ({ title: l.title, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 })),
          }),
        );
        return formAction(fd);
      }}
      data-save-shortcut
      className="space-y-4"
    >
      <p className="rounded-lg bg-background p-3 text-sm text-muted">
        For sales with no offer and no job card. To bill an offer, use its Invoicing panel; to bill workshop work, use the job card.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Customer *
          <select ref={first} value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
            <option value="">— Not saved: type the name below —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Vessel
          <select name="vesselId" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {boats.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        {!customerId && (
          <>
            <label className={labelClass}>
              Customer name *
              <input name="customerName" maxLength={200} className={inputClass} />
            </label>
            <label className={labelClass}>
              Customer VAT no.
              <input name="customerTaxNumber" maxLength={100} className={inputClass} />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Customer address
              <textarea name="customerAddress" rows={2} maxLength={500} className={inputClass} />
            </label>
          </>
        )}
        <label className={labelClass}>
          Subject
          <input name="subject" maxLength={300} className={inputClass} />
        </label>
        <label className={labelClass}>
          Customer reference
          <input name="reference" maxLength={200} className={inputClass} />
        </label>
      </div>

      <FreeLinesEditor lines={lines} onChange={setLines} catalogue={catalogue} listId="standalone-catalogue" />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Payment due in (days)
          <input name="dueDays" type="number" min="0" max="365" defaultValue="0" className={inputClass} />
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} className="size-4 accent-brand" />
          Charge VAT {VAT_RATE * 100}%
        </label>
        <div className="pt-5 text-right text-sm">
          <p className="text-muted">
            {formatMoney(ht)} + VAT {formatMoney(vat)}
          </p>
          <p className="tabular text-lg font-semibold text-navy">{formatMoney(round2(ht + vat))}</p>
        </div>
      </div>
      <label className={labelClass}>
        Notes printed on the invoice
        <textarea name="notes" rows={2} maxLength={2000} className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Creating…" : "Create invoice"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
