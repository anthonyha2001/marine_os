"use client";

import { useActionState, useState } from "react";
import { refundSale, updateSaleCustomer, type PosFormState } from "@/lib/actions/pos";
import { VAT_RATE, formatMoney, round2 } from "@/lib/money";
import { REFUND_METHODS, formatLbp, roundLbp } from "@/lib/pos";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

type Line = { id: string; name: string; code: string; quantity: number; refunded: number; unitPriceHT: number };

/** Return goods from a sale: quantity per line, how the money goes back, why. */
export function RefundForm({ companySlug, saleId, lines, discountPct, maxRefund, rate }: { companySlug: string; saleId: string; lines: Line[]; discountPct: number; maxRefund: number; rate: number }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("CASH_USD");
  const [state, formAction, pending] = useActionState<PosFormState, FormData>(refundSale.bind(null, companySlug, saleId), {});
  const reason = useFocusOnShow<HTMLInputElement>();
  const ht = round2(lines.reduce((s, l) => s + round2(l.unitPriceHT * (qty[l.id] ?? 0) * (1 - discountPct / 100)), 0));
  const total = Math.min(round2(ht + round2(ht * VAT_RATE)), maxRefund);

  return (
    <form
      action={(fd) => {
        fd.set("payload", JSON.stringify({ lines: lines.map((l) => ({ saleLineId: l.id, quantity: qty[l.id] ?? 0 })), method, reason: fd.get("reason") }));
        return formAction(fd);
      }}
      data-save-shortcut
      className="space-y-4"
    >
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="py-2">Product</th>
            <th className="py-2 text-right">Can return</th>
            <th className="w-28 py-2 text-right">Returned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lines.map((l) => {
            const left = l.quantity - l.refunded;
            return (
              <tr key={l.id}>
                <td className="py-2">
                  <span className="font-medium text-navy">{l.name}</span> <span className="font-mono text-xs text-muted">{l.code}</span>
                </td>
                <td className="tabular py-2 text-right text-muted">{left}</td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    max={left}
                    disabled={left === 0}
                    value={qty[l.id] ?? 0}
                    onChange={(e) => setQty((q) => ({ ...q, [l.id]: Math.min(left, Math.max(0, Math.floor(Number(e.target.value) || 0))) }))}
                    aria-label={`Quantity of ${l.name} returned`}
                    className={`${inputClass} h-9 w-20 text-right`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Give the money back as *
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
            {Object.entries(REFUND_METHODS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Reason *
          <input ref={reason} name="reason" required minLength={3} maxLength={500} placeholder="e.g. Wrong size" className={inputClass} />
        </label>
      </div>
      <p className="rounded-lg bg-background p-3 text-sm">
        To give back: <span className="tabular font-semibold text-navy">{method === "CASH_LBP" ? formatLbp(roundLbp(total * rate)) : formatMoney(total)}</span>
        {method === "CASH_LBP" && <span className="text-muted"> ({formatMoney(total)})</span>}
      </p>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending || total <= 0} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Refund"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

/** Customer details printed on the A4 tax invoice. */
export function SaleCustomerForm({ companySlug, saleId, name, address, taxNumber }: { companySlug: string; saleId: string; name: string; address: string | null; taxNumber: string | null }) {
  const [state, formAction, pending] = useActionState<PosFormState, FormData>(updateSaleCustomer.bind(null, companySlug, saleId), {});
  return (
    <form action={formAction} className="space-y-3">
      <label className={labelClass}>
        Customer name *
        <input name="customerName" required minLength={2} maxLength={200} defaultValue={name === "Walk-in customer" ? "" : name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Address
        <textarea name="customerAddress" rows={2} maxLength={500} defaultValue={address ?? ""} className={inputClass} />
      </label>
      <label className={labelClass}>
        VAT number
        <input name="customerTaxNumber" maxLength={100} defaultValue={taxNumber ?? ""} className={inputClass} />
      </label>
      <FormMessage error={state.error} success={state.saved ? "Saved. The tax invoice now shows these details." : undefined} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Saving…" : "Save customer details"}
      </button>
    </form>
  );
}
