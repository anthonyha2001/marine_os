"use client";

import { useActionState, useState } from "react";
import { createCustomInvoice, type CustomInvoiceState } from "@/lib/actions/invoices";
import { formatMoney, round2 } from "@/lib/money";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

export type InvoiceableOffer = {
  id: string;
  number: string;
  customerName: string;
  subject: string | null;
  totalHT: number;
  totalTTC: number;
  remaining: number;
};

/**
 * Invoice any amount against an offer (e.g. an extra $50 payment), outside its schedule.
 * With one offer it's fixed (opened from that offer); otherwise the user picks the offer.
 */
export function CustomInvoiceForm({
  companySlug,
  offers,
  returnTo,
}: {
  companySlug: string;
  offers: InvoiceableOffer[];
  returnTo: "offer" | "invoice";
}) {
  const [offerId, setOfferId] = useState(offers.length === 1 ? offers[0].id : "");
  const [amount, setAmount] = useState("");
  const [dirty, setDirty] = useState(false);
  const firstField = useFocusOnShow<HTMLInputElement>();
  const [state, formAction, pending] = useActionState<CustomInvoiceState, FormData>(
    createCustomInvoice.bind(null, companySlug),
    {},
  );

  const offer = offers.find((o) => o.id === offerId);
  const value = Number(amount) || 0;
  const tooMuch = offer ? value > offer.remaining + 0.001 : false;
  const ht = offer && offer.totalTTC > 0 ? round2((value * offer.totalHT) / offer.totalTTC) : value;

  if (offers.length === 0) {
    return <p className="text-sm text-muted">There are no offers with an amount left to invoice.</p>;
  }

  return (
    <form action={formAction} data-save-shortcut data-dirty={dirty} onInput={() => setDirty(true)} className="space-y-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      {offers.length === 1 ? (
        <input type="hidden" name="offerId" value={offerId} />
      ) : (
        <label className={labelClass}>
          Offer *
          <select name="offerId" required value={offerId} onChange={(e) => setOfferId(e.target.value)} className={inputClass}>
            <option value="">Choose the customer / offer…</option>
            {[...offers]
              .sort((a, b) => a.customerName.localeCompare(b.customerName) || a.number.localeCompare(b.number))
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.customerName} — {o.number}
                  {o.subject ? ` · ${o.subject}` : ""} · {formatMoney(o.remaining)} left
                </option>
              ))}
          </select>
        </label>
      )}

      {offer && (
        <div className="rounded-lg bg-surface p-3">
          <p className="text-xs uppercase tracking-wider text-muted">Customer</p>
          <p className="font-semibold text-navy">{offer.customerName}</p>
          <p className="text-xs text-muted">
            Offer {offer.number}
            {offer.subject ? ` · ${offer.subject}` : ""}
          </p>
        </div>
      )}

      {offer && (
        <dl className="grid grid-cols-3 gap-3 rounded-lg bg-surface p-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Offer total</dt>
            <dd className="font-medium">{formatMoney(offer.totalTTC)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Already invoiced</dt>
            <dd className="font-medium">{formatMoney(round2(offer.totalTTC - offer.remaining))}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Left to invoice</dt>
            <dd className="font-semibold text-navy">{formatMoney(offer.remaining)}</dd>
          </div>
        </dl>
      )}

      <label className={labelClass}>
        Description *
        <input ref={firstField} name="title" required defaultValue="Partial payment" className={inputClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Amount incl. VAT *
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50"
            className={inputClass}
          />
          {offer && value > 0 && !tooMuch && (
            <span className="mt-1 block text-xs font-normal text-muted">
              {formatMoney(ht)} excl. VAT + {formatMoney(round2(value - ht))} VAT
            </span>
          )}
          {tooMuch && offer && (
            <span className="mt-1 block text-xs font-normal text-danger">Only {formatMoney(offer.remaining)} is left on this offer.</span>
          )}
        </label>
        <label className={labelClass}>
          Due (days after today)
          <input name="dueDays" type="number" min="0" step="1" defaultValue={0} className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        Note printed on the invoice
        <textarea name="notes" rows={2} className={inputClass} placeholder="Optional" />
      </label>

      <p className="text-xs text-muted">
        Later scheduled payments are reduced automatically, so the offer is never invoiced for more than its total.
      </p>

      <FormMessage error={state.error} />
      <button type="submit" disabled={pending || tooMuch} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Creating…" : "Create invoice"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
