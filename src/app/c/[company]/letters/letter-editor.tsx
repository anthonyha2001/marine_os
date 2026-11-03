"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { previewLetter, saveLetter, type LetterFormState } from "@/lib/actions/letters";
import { MARKING_SUGGESTIONS } from "@/lib/offers";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButton, secondaryButtonSm, StickyActions } from "@/components/ui";
import type { CustomerOption } from "../offers/offer-editor";

export type OfferOption = { id: string; number: string; customerId: string | null; customerName: string; subject: string | null };

export type LetterEditorValue = {
  id: string;
  customerId: string | null;
  offerId: string | null;
  customerName: string;
  customerAttention: string | null;
  customerAddress: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  letterDate: string;
  title: string;
  reference: string | null;
  subject: string | null;
  salutation: string | null;
  body: string;
  closing: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  fields: { label: string; value: string }[];
  enclosures: string | null;
  cc: string | null;
  marking: string | null;
  acknowledgment: boolean;
  notes: string | null;
};

const TITLE_SUGGESTIONS = [
  "OFFICIAL LETTER",
  "COVER LETTER",
  "TO WHOM IT MAY CONCERN",
  "CERTIFICATE OF COMPLETION",
  "LETTER OF AUTHORISATION",
  "LETTER OF CONFIRMATION",
  "NOTICE",
];

const FIELD_SUGGESTIONS = ["Vessel", "Registration / IMO", "Port", "Engine", "Serial number", "Date of works", "Job card", "Invoice"];

export function LetterEditor({
  companySlug,
  companyName,
  customers,
  offers,
  letter,
  userName,
  defaultCustomerId,
  defaultOfferId,
}: {
  companySlug: string;
  companyName: string;
  customers: CustomerOption[];
  offers: OfferOption[];
  letter?: LetterEditorValue;
  userName: string;
  defaultCustomerId?: string;
  defaultOfferId?: string; // new letter started from an offer
}) {
  const presetOffer = letter ? undefined : offers.find((o) => o.id === defaultOfferId);
  const preset = letter ? undefined : customers.find((c) => c.id === (presetOffer?.customerId ?? defaultCustomerId));
  const today = new Date();
  const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [form, setForm] = useState({
    customerId: letter?.customerId ?? preset?.id ?? "",
    offerId: letter?.offerId ?? presetOffer?.id ?? "",
    customerName: letter?.customerName ?? preset?.name ?? presetOffer?.customerName ?? "",
    customerAttention: letter?.customerAttention ?? preset?.contactName ?? "",
    customerAddress: letter?.customerAddress ?? preset?.address ?? "",
    customerEmail: letter?.customerEmail ?? preset?.email ?? "",
    customerPhone: letter?.customerPhone ?? preset?.phone ?? "",
    letterDate: letter?.letterDate ?? isoToday,
    title: letter?.title ?? "OFFICIAL LETTER",
    reference: letter?.reference ?? "",
    subject: letter?.subject ?? (presetOffer ? `Our offer ${presetOffer.number}${presetOffer.subject ? ` – ${presetOffer.subject}` : ""}` : ""),
    salutation: letter?.salutation ?? "Dear Sir / Madam,",
    body: letter?.body ?? "",
    closing: letter?.closing ?? "Yours faithfully,",
    signatoryName: letter?.signatoryName ?? userName,
    signatoryTitle: letter?.signatoryTitle ?? "",
    enclosures: letter?.enclosures ?? "",
    cc: letter?.cc ?? "",
    marking: letter?.marking ?? "",
    acknowledgment: letter?.acknowledgment ?? false,
    notes: letter?.notes ?? "",
  });
  const [fields, setFields] = useState(letter?.fields ?? []);
  const [dirty, setDirty] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerHighlight, setCustomerHighlight] = useState(0);
  const customerInput = useFocusOnShow<HTMLInputElement>(!letter && !preset);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function pickCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      customerId: id,
      // An offer of another customer no longer applies.
      offerId: offers.find((o) => o.id === f.offerId)?.customerId === id ? f.offerId : "",
      ...(c && {
        customerName: c.name,
        customerAttention: c.contactName ?? "",
        customerAddress: c.address ?? "",
        customerEmail: c.email ?? "",
        customerPhone: c.phone ?? "",
      }),
    }));
    setCustomerOpen(false);
    setDirty(true);
  }

  // Suggestions while typing a name that isn't linked to a saved customer yet.
  const customerMatches = useMemo(() => {
    const words = form.customerName.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!customerOpen || form.customerId || !words.length) return [];
    return customers
      .filter((c) => {
        const text = [c.name, c.contactName, c.phone, c.email].filter(Boolean).join(" ").toLowerCase();
        const compact = text.replace(/\s+/g, ""); // so 03123456 finds "03 123 456"
        return words.every((w) => text.includes(w) || compact.includes(w));
      })
      .slice(0, 8);
  }, [customers, customerOpen, form.customerId, form.customerName]);

  function onCustomerKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!customerMatches.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : customerMatches.length - 1;
      setCustomerHighlight((i) => (i + step) % customerMatches.length);
    } else if (e.key === "Enter") {
      e.preventDefault(); // pick the customer, don't submit the letter
      pickCustomer(customerMatches[Math.min(customerHighlight, customerMatches.length - 1)].id);
    } else if (e.key === "Escape") {
      setCustomerOpen(false);
    }
  }

  const customerOffers = offers.filter((o) => !form.customerId || o.customerId === form.customerId || o.id === form.offerId);

  function updateField(index: number, patch: Partial<{ label: string; value: string }>) {
    setFields((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  const buildPayload = () => ({ ...form, customerId: form.customerId || undefined, offerId: form.offerId || undefined, fields });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string>();
  const [previewing, startPreview] = useTransition();
  const preview = () =>
    startPreview(async () => {
      setPreviewError(undefined);
      const res = await previewLetter(companySlug, JSON.stringify(buildPayload()));
      if (res.error || !res.pdf) return setPreviewError(res.error ?? "The preview couldn't be made.");
      const bytes = Uint8Array.from(atob(res.pdf), (c) => c.charCodeAt(0));
      setPreviewUrl(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
    });
  const [state, formAction, pending] = useActionState<LetterFormState, FormData>(async (prev) => {
    const fd = new FormData();
    fd.set("payload", JSON.stringify(buildPayload()));
    return saveLetter(companySlug, letter?.id ?? null, prev, fd);
  }, {});

  return (
    <form action={formAction} data-save-shortcut data-dirty={dirty} data-enter-no-submit className="mt-6 space-y-6">
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-navy">To</h2>
            {form.customerId && (
              <span className="text-sm text-muted">
                Saved customer ·{" "}
                <button type="button" onClick={() => pickCustomer("")} className="text-brand hover:underline">
                  Unlink
                </button>
              </span>
            )}
          </div>
          <div className="relative">
            <label className={labelClass}>
              Company / organisation / person *
              <input
                ref={customerInput}
                value={form.customerName}
                onChange={(e) => {
                  set("customerName", e.target.value);
                  setCustomerOpen(true);
                  setCustomerHighlight(0);
                }}
                onBlur={() => setCustomerOpen(false)}
                onKeyDown={onCustomerKey}
                className={inputClass}
                placeholder="Search saved customers, or type any name"
                autoComplete="off"
                role="combobox"
                aria-expanded={customerMatches.length > 0}
                aria-controls="letter-customer-matches"
                required
              />
            </label>
            {customerMatches.length > 0 && (
              <ul id="letter-customer-matches" role="listbox" aria-label="Saved customers" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
                {customerMatches.map((c, i) => (
                  <li key={c.id} role="option" aria-selected={i === customerHighlight}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickCustomer(c.id)}
                      onMouseEnter={() => setCustomerHighlight(i)}
                      className={`block w-full rounded-md px-3 py-2 text-left text-sm ${i === customerHighlight ? "bg-surface-2" : ""}`}
                    >
                      <span className="font-medium text-navy">{c.name}</span>
                      {(c.contactName || c.phone || c.email) && (
                        <span className="block text-xs text-muted">{[c.contactName, c.phone, c.email].filter(Boolean).join(" · ")}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Attention (contact person)
              <input value={form.customerAttention} onChange={(e) => set("customerAttention", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Phone
              <input value={form.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className={labelClass}>
            Email
            <input type="email" value={form.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Address
            <textarea rows={2} value={form.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} className={inputClass} />
          </label>
          {!form.customerId && form.customerName.trim().length > 1 && (
            <p className="text-sm text-muted">Not a saved customer: the letter is addressed to this name only.</p>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-navy">Letter</h2>
          <label className={labelClass}>
            Title (printed at the top) *
            <input list="letter-titles" value={form.title} onChange={(e) => set("title", e.target.value.toUpperCase())} className={inputClass} required />
            <datalist id="letter-titles">
              {TITLE_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className={labelClass}>
            Subject
            <input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Completion of engine overhaul – M/Y Sea Breeze" className={inputClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Date *
              <input type="date" value={form.letterDate} onChange={(e) => set("letterDate", e.target.value)} className={inputClass} required />
            </label>
            <label className={labelClass}>
              Their reference
              <input value={form.reference} onChange={(e) => set("reference", e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className={labelClass}>
            About offer
            <select value={form.offerId} onChange={(e) => set("offerId", e.target.value)} className={inputClass}>
              <option value="">— None —</option>
              {customerOffers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} · {o.customerName}
                  {o.subject ? ` · ${o.subject}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Protective marking (printed on every page)
            <input list="letter-markings" value={form.marking} onChange={(e) => set("marking", e.target.value.toUpperCase())} placeholder="None" className={inputClass} />
            <datalist id="letter-markings">
              {MARKING_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <p className="text-xs text-muted">On the letterhead of {companyName}. The number is given when you save.</p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <label className={labelClass}>
          Greeting
          <input value={form.salutation} onChange={(e) => set("salutation", e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Letter text * <span className="font-normal text-muted">(leave a blank line between paragraphs)</span>
          <textarea rows={12} value={form.body} onChange={(e) => set("body", e.target.value)} className={inputClass} required />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-navy">Details table</h2>
            <p className="text-sm text-muted">Your own rows, printed under the text (e.g. Vessel, Port, Engine serial).</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFields((rows) => [...rows, { label: "", value: "" }]);
              setDirty(true);
            }}
            className={secondaryButtonSm}
          >
            <Plus className="size-3.5" aria-hidden /> Add row
          </button>
        </div>
        <datalist id="letter-field-labels">
          {FIELD_SUGGESTIONS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        {fields.map((f, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-end gap-3">
            <label className={labelClass}>
              <span className="sr-only">Label</span>
              <input list="letter-field-labels" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Label" className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className="sr-only">Value</span>
              <input value={f.value} onChange={(e) => updateField(i, { value: e.target.value })} placeholder="Value" className={inputClass} />
            </label>
            <button
              type="button"
              onClick={() => {
                setFields((rows) => rows.filter((_, j) => j !== i));
                setDirty(true);
              }}
              className="mb-1 rounded-md p-2 text-muted hover:bg-red-50 hover:text-danger"
              title="Remove row"
              aria-label="Remove row"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-navy">Signature</h2>
          <label className={labelClass}>
            Closing
            <input value={form.closing} onChange={(e) => set("closing", e.target.value)} className={inputClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Signed by
              <input value={form.signatoryName} onChange={(e) => set("signatoryName", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Position
              <input value={form.signatoryTitle} onChange={(e) => set("signatoryTitle", e.target.value)} placeholder="e.g. General Manager" className={inputClass} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.acknowledgment} onChange={(e) => set("acknowledgment", e.target.checked)} />
            Add a “received by the customer” signature box
          </label>
        </div>
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-navy">Other</h2>
          <label className={labelClass}>
            Enclosures
            <input value={form.enclosures} onChange={(e) => set("enclosures", e.target.value)} placeholder="e.g. Offer XM-OF-2026-0004, test report" className={inputClass} />
          </label>
          <label className={labelClass}>
            Copy to
            <input value={form.cc} onChange={(e) => set("cc", e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Internal notes (never printed)
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} />
          </label>
        </div>
      </section>

      <FormMessage error={state.error ?? previewError} />

      <StickyActions summary={<span>{form.customerName || "New letter"}</span>}>
        <Link href={`/c/${companySlug}/letters`} className={secondaryButton}>
          Cancel
        </Link>
        <button type="button" onClick={preview} disabled={previewing} className={secondaryButton}>
          {previewing ? "Preparing…" : "Preview PDF"}
        </button>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : letter ? "Save changes" : "Save letter"}
          <Kbd className="border-white/20 bg-white/10 text-white/80">Ctrl S</Kbd>
        </button>
      </StickyActions>
      {previewUrl && (
        <Modal title="Preview (not saved yet)" onClose={() => setPreviewUrl(null)} size="xl">
          <iframe src={previewUrl} title="Letter preview" className="h-[75vh] w-full rounded-lg border border-border" />
        </Modal>
      )}
    </form>
  );
}
