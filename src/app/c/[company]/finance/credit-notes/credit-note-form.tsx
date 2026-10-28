"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createCreditNote, type FinanceFormState } from "@/lib/actions/finance";
import { today } from "@/lib/dates";
import { VAT_RATE, formatMoney, round2 } from "@/lib/money";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, StickyActions, cardClass, inputClass, labelClass, primaryButton, secondaryButtonSm } from "@/components/ui";

export type CreditableInvoice = {
  id: string;
  number: string;
  customerName: string;
  applyVat: boolean;
  totalTTC: number;
  creditable: number;
  lines: { title: string; quantity: number; unitPrice: number }[];
};

type Line = { key: string; title: string; quantity: string; unitPrice: string };
const blank = (): Line => ({ key: crypto.randomUUID(), title: "", quantity: "1", unitPrice: "" });

/** Credit note against an invoice: pick lines from it (or type them) and give the reason. */
export function CreditNoteForm({ companySlug, invoices, initialInvoiceId }: { companySlug: string; invoices: CreditableInvoice[]; initialInvoiceId?: string }) {
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId && invoices.some((i) => i.id === initialInvoiceId) ? initialInvoiceId : (invoices[0]?.id ?? ""));
  const [lines, setLines] = useState<Line[]>(() => [blank()]);
  const [state, formAction, pending] = useActionState<FinanceFormState, FormData>(createCreditNote.bind(null, companySlug), {});
  const reasonInput = useFocusOnShow<HTMLInputElement>();
  const invoice = invoices.find((i) => i.id === invoiceId);

  const parsed = lines.map((l) => ({ title: l.title.trim(), quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 }));
  const totalHT = round2(parsed.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
  const vat = invoice?.applyVat ? round2(totalHT * VAT_RATE) : 0;
  const total = round2(totalHT + vat);
  const tooMuch = !!invoice && total > invoice.creditable + 0.005;
  const set = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form
      action={(fd) => {
        fd.set(
          "payload",
          JSON.stringify({
            invoiceId,
            date: fd.get("date"),
            reason: fd.get("reason"),
            lines: parsed.filter((l) => l.title || l.unitPrice),
          }),
        );
        return formAction(fd);
      }}
      data-save-shortcut
      className="space-y-6"
    >
      <section className={`${cardClass} grid gap-4 p-5 sm:grid-cols-3`}>
        <label className={`${labelClass} sm:col-span-2`}>
          Invoice *
          <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required className={inputClass}>
            {invoices.length === 0 && <option value="">No invoice can be credited</option>}
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.number} · {i.customerName} · up to {formatMoney(i.creditable)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Date *
          <input name="date" type="date" required defaultValue={today()} className={inputClass} />
        </label>
        <label className={`${labelClass} sm:col-span-3`}>
          Reason *
          <input ref={reasonInput} name="reason" required minLength={3} maxLength={500} placeholder="e.g. Returned goods, price correction, discount granted" className={inputClass} />
        </label>
      </section>

      <section className={`${cardClass} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-navy">Lines (excl. VAT)</h2>
          {invoice && invoice.lines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButtonSm}
                onClick={() => setLines(invoice.lines.map((l) => ({ key: crypto.randomUUID(), title: l.title, quantity: String(l.quantity), unitPrice: String(l.unitPrice) })))}
              >
                Copy all invoice lines
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2 pr-2">Description</th>
                <th className="w-24 py-2 pr-2 text-right">Qty</th>
                <th className="w-36 py-2 pr-2 text-right">Unit price</th>
                <th className="w-32 py-2 pr-2 text-right">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.key}>
                  <td className="py-1 pr-2">
                    <input
                      value={l.title}
                      onChange={(e) => set(l.key, { title: e.target.value })}
                      list="cn-invoice-lines"
                      aria-label={`Line ${i + 1} description`}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min="0" step="any" value={l.quantity} onChange={(e) => set(l.key, { quantity: e.target.value })} aria-label={`Line ${i + 1} quantity`} className={`${inputClass} text-right`} />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => set(l.key, { unitPrice: e.target.value })} aria-label={`Line ${i + 1} unit price`} className={`${inputClass} text-right`} />
                  </td>
                  <td className="tabular py-1 pr-2 text-right font-medium">{formatMoney(round2(parsed[i].quantity * parsed[i].unitPrice))}</td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      title="Remove line"
                      aria-label="Remove line"
                      disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-danger disabled:opacity-30"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="cn-invoice-lines">
            {invoice?.lines.map((l, i) => <option key={i} value={l.title} />)}
          </datalist>
        </div>
        <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} className={`${secondaryButtonSm} mt-3`}>
          <Plus className="size-3.5" aria-hidden /> Add line
        </button>
      </section>

      <FormMessage error={state.error ?? (tooMuch && invoice ? `At most ${formatMoney(invoice.creditable)} can be credited on ${invoice.number}.` : undefined)} />

      <StickyActions
        summary={
          <span>
            {formatMoney(totalHT)} + VAT {invoice?.applyVat ? formatMoney(vat) : "exempt"} ={" "}
            <span className="font-semibold text-navy">{formatMoney(total)}</span>
          </span>
        }
      >
        <button type="submit" disabled={pending || tooMuch || total <= 0 || !invoice} className={`${primaryButton} gap-2`}>
          {pending ? "Saving…" : "Issue credit note"}
          <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
      </StickyActions>
    </form>
  );
}
