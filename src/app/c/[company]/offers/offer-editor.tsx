"use client";

import { Modal } from "@/components/modal";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { previewOffer, saveOffer, type OfferFormState } from "@/lib/actions/offers";
import { formatMoney, VAT_RATE } from "@/lib/money";
import {
  MARKING_SUGGESTIONS,
  MAX_INSTALLMENTS,
  OFFER_STATUSES,
  PAYMENT_PLANS,
  PERCENT_PRESETS,
  equalTerms,
  fullTerms,
  percentTerms,
  schedulePayments,
  scheduleProblem,
  termsForPlan,
  type PaymentPlan,
  amountInWords,
  itemNumbers,
  lineTotal,
  offerTotals,
  type DiscountType,
  type OfferStatus,
} from "@/lib/offers";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButton, StickyActions } from "@/components/ui";

export type CatalogueOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: "PRODUCT" | "SERVICE";
  unit: string;
  priceHT: number;
  barcodes: string[];
};

export type CustomerOption = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

const MAX_PICKER_ROWS = 100;

const INCOTERMS: [string, string][] = [
  ["EXW", "Ex works"], ["FCA", "Free carrier"], ["FOB", "Free on board"], ["CFR", "Cost and freight"], ["CIF", "Cost, insurance and freight"],
  ["CPT", "Carriage paid to"], ["CIP", "Carriage and insurance paid to"], ["DAP", "Delivered at place"], ["DPU", "Delivered at place unloaded"], ["DDP", "Delivered duty paid"],
];

export type OfferEditorValue = {
  id: string;
  customerId: string | null;
  vesselId: string | null;
  incoterm: string | null;
  deliveryPlace: string | null;
  leadTime: string | null;
  warranty: string | null;
  customerName: string;
  customerAttention: string | null;
  customerAddress: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  subject: string | null;
  reference: string | null;
  offerDate: string;
  validUntil: string;
  status: OfferStatus;
  marking: string | null;
  intro: string | null;
  terms: string | null;
  notes: string | null;
  discountType: DiscountType;
  discountValue: number;
  applyVat: boolean;
  paymentPlan: PaymentPlan;
  paymentTerms: { label: string; value: number; percent: number; dueDays: number }[];
  locked: boolean;
  lines: {
    kind: "ITEM" | "SECTION";
    productId: string | null;
    code: string | null;
    title: string;
    description: string | null;
    quantity: number;
    unit: string | null;
    unitPrice: number;
    discountPercent: number;
  }[];
};

type Line = {
  key: number;
  kind: "ITEM" | "SECTION";
  productId: string | null;
  code: string | null;
  title: string;
  description: string;
  showDescription: boolean;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
};

type PayRow = { label: string; value: string; dueDays: string };

const UNITS = ["pc", "hr", "day", "lot", "set", "unit", "m", "kg", "L"];
const cell =
  "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function isoDate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function OfferEditor({
  companySlug,
  companyName,
  catalogue,
  customers,
  defaultIntro,
  defaultTerms,
  offer,
  vessels = [],
  clauses = [],
  defaultCustomerId,
  returnTo,
}: {
  vessels?: { id: string; customerId: string | null; label: string }[];
  clauses?: { id: string; title: string; text: string }[];
  companySlug: string;
  companyName: string;
  catalogue: CatalogueOption[];
  customers: CustomerOption[];
  defaultIntro: string;
  defaultTerms: string;
  offer?: OfferEditorValue;
  defaultCustomerId?: string; // new offer started from a customer page
  returnTo?: string; // opened in a pop-up: come back to this page after saving
}) {
  // Saved lines get keys 1..n; lines added later continue from n + 1.
  const nextKey = useRef((offer?.lines.length ?? 0) + 1);
  const toLine = (l: OfferEditorValue["lines"][number], key: number): Line => ({
    key,
    kind: l.kind,
    productId: l.productId,
    code: l.code,
    title: l.title,
    description: l.description ?? "",
    showDescription: !!l.description,
    quantity: String(l.quantity),
    unit: l.unit ?? "",
    unitPrice: String(l.unitPrice),
    discountPercent: l.discountPercent ? String(l.discountPercent) : "",
  });

  const today = new Date();
  const preset = offer ? undefined : customers.find((c) => c.id === defaultCustomerId);
  const [header, setHeader] = useState({
    customerId: offer?.customerId ?? preset?.id ?? "",
    vesselId: offer?.vesselId ?? "",
    incoterm: offer?.incoterm ?? "",
    deliveryPlace: offer?.deliveryPlace ?? "",
    leadTime: offer?.leadTime ?? "",
    warranty: offer?.warranty ?? "",
    customerName: offer?.customerName ?? preset?.name ?? "",
    customerAttention: offer?.customerAttention ?? preset?.contactName ?? "",
    customerAddress: offer?.customerAddress ?? preset?.address ?? "",
    customerEmail: offer?.customerEmail ?? preset?.email ?? "",
    customerPhone: offer?.customerPhone ?? preset?.phone ?? "",
    subject: offer?.subject ?? "",
    reference: offer?.reference ?? "",
    offerDate: offer?.offerDate ?? isoDate(today),
    validUntil: offer?.validUntil ?? isoDate(new Date(today.getTime() + 30 * 86400000)),
    status: offer?.status ?? ("DRAFT" as OfferStatus),
    marking: offer?.marking ?? "",
    intro: offer?.intro ?? defaultIntro,
    terms: offer?.terms ?? defaultTerms,
    notes: offer?.notes ?? "",
    discountType: offer?.discountType ?? ("PERCENT" as DiscountType),
    discountValue: offer?.discountValue ? String(offer.discountValue) : "",
    applyVat: offer?.applyVat ?? true,
  });
  const [lines, setLines] = useState<Line[]>(() => offer?.lines.map((l, i) => toLine(l, i + 1)) ?? []);
  const [saveCustomer, setSaveCustomer] = useState(true);
  // Payment schedule: plan + editable rows (descriptions, % for "Percentages", due days).
  const [plan, setPlan] = useState<PaymentPlan>(offer?.paymentPlan ?? "FULL");
  const [installments, setInstallments] = useState(
    offer?.paymentPlan === "INSTALLMENTS" ? String(offer.paymentTerms.length) : "3",
  );
  const [payRows, setPayRows] = useState<PayRow[]>(() =>
    (offer?.paymentTerms.length ? offer.paymentTerms : fullTerms()).map((t) => ({
      label: t.label,
      value: String(t.value),
      dueDays: String(t.dueDays),
    })),
  );
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [dirty, setDirty] = useState(false);
  const customerInput = useFocusOnShow<HTMLInputElement>(!offer);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerHighlight, setCustomerHighlight] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const pickerList = useRef<HTMLUListElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const set = <K extends keyof typeof header>(key: K, value: (typeof header)[K]) => {
    setHeader((h) => ({ ...h, [key]: value }));
    setDirty(true);
  };
  const updateLine = (key: number, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setDirty(true);
  };

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The whole catalogue when browsing (nothing typed), narrowed down as you type.
  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    return catalogue
      .filter((c) => {
        if (!q || c.code.startsWith(q) || c.barcodes.includes(q)) return true;
        const name = c.name.toLowerCase();
        return words.every((w) => name.includes(w));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [search, catalogue]);
  const suggestions = useMemo(() => (pickerOpen ? matching.slice(0, MAX_PICKER_ROWS) : []), [matching, pickerOpen]);

  // Keep the row chosen with the arrow keys in view.
  useEffect(() => {
    pickerList.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function addLine(line: Omit<Line, "key">) {
    setLines((ls) => [...ls, { ...line, key: nextKey.current++ }]);
    setSearch("");
    setHighlight(0);
    setPickerOpen(false);
    setDirty(true);
    searchInput.current?.focus();
  }

  const fromCatalogue = (c: CatalogueOption) =>
    addLine({
      kind: "ITEM",
      productId: c.id,
      code: c.code,
      title: c.name,
      description: c.description ?? "",
      showDescription: !!c.description,
      quantity: "1",
      unit: c.unit,
      unitPrice: String(c.priceHT),
      discountPercent: "",
    });

  const customLine = (title = "") =>
    addLine({
      kind: "ITEM",
      productId: null,
      code: null,
      title,
      description: "",
      showDescription: false,
      quantity: "1",
      unit: "pc",
      unitPrice: "",
      discountPercent: "",
    });

  const sectionLine = (title = "") =>
    addLine({
      kind: "SECTION",
      productId: null,
      code: null,
      title,
      description: "",
      showDescription: false,
      quantity: "0",
      unit: "",
      unitPrice: "0",
      discountPercent: "",
    });

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") setPickerOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!pickerOpen) return setPickerOpen(true);
      if (e.key === "ArrowDown") setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
      else setHighlight((h) => Math.max(h - 1, 0));
    }
    if (e.key !== "Enter") return;
    const q = search.trim();
    if (!q) {
      if (suggestions[highlight]) fromCatalogue(suggestions[highlight]);
      return;
    }
    if (e.shiftKey) return sectionLine(q);
    const exact = catalogue.find((c) => c.code === q || c.barcodes.includes(q));
    const pick = exact ?? suggestions[highlight];
    if (pick) fromCatalogue(pick);
    else customLine(q);
  }

  function move(index: number, delta: number) {
    setLines((ls) => {
      const target = index + delta;
      if (target < 0 || target >= ls.length) return ls;
      const copy = [...ls];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    setDirty(true);
  }

  function pickCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    setHeader((h) => ({
      ...h,
      customerId: id,
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
    const words = header.customerName.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!customerOpen || header.customerId || !words.length) return [];
    return customers
      .filter((c) => {
        const text = [c.name, c.contactName, c.phone, c.email].filter(Boolean).join(" ").toLowerCase();
        const compact = text.replace(/\s+/g, ""); // so 03123456 finds "03 123 456"
        return words.every((w) => text.includes(w) || compact.includes(w));
      })
      .slice(0, 8);
  }, [customers, customerOpen, header.customerId, header.customerName]);

  function onCustomerKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!customerMatches.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : customerMatches.length - 1;
      setCustomerHighlight((i) => (i + step) % customerMatches.length);
    } else if (e.key === "Enter") {
      e.preventDefault(); // pick the customer, don't submit the offer
      pickCustomer(customerMatches[Math.min(customerHighlight, customerMatches.length - 1)].id);
    } else if (e.key === "Escape") {
      setCustomerOpen(false);
    }
  }

  const numeric = lines.map((l) => ({
    kind: l.kind,
    quantity: Number(l.quantity) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    discountPercent: Number(l.discountPercent) || 0,
  }));
  const totals = offerTotals(numeric, header.discountType, Number(header.discountValue) || 0, header.applyVat);

  const termInputs = payRows.map((r) => ({
    label: r.label,
    mode: "PERCENT" as const,
    value: Number(r.value) || 0,
    dueDays: Math.max(0, Math.floor(Number(r.dueDays) || 0)),
  }));
  const planTerms = termsForPlan(plan, termInputs, Number(installments) || 1);
  const schedule = schedulePayments(planTerms, totals.totalTTC);
  const problem = scheduleProblem(plan, planTerms);

  // Generated rows keep any due days already typed for the same position.
  const toRows = (terms: { label: string; value: number; dueDays: number }[]): PayRow[] =>
    terms.map((t, i) => ({ label: t.label, value: String(t.value), dueDays: payRows[i]?.dueDays ?? String(t.dueDays) }));

  function choosePlan(next: PaymentPlan) {
    setPlan(next);
    setDirty(true);
    if (next === "FULL") setPayRows(toRows(fullTerms()));
    if (next === "INSTALLMENTS") setPayRows(toRows(equalTerms(Number(installments) || 3)));
    // Switching to percentages keeps the current split as a starting point.
    if (next === "PERCENT") {
      setPayRows(schedule.payments.map((p, i) => ({ label: p.label, value: String(p.percent), dueDays: payRows[i]?.dueDays ?? "0" })));
    }
  }

  function setInstallmentCount(value: string) {
    setInstallments(value);
    setDirty(true);
    const n = Number(value);
    if (n >= 1 && n <= MAX_INSTALLMENTS) setPayRows(toRows(equalTerms(n)));
  }

  function updatePayRow(index: number, patch: Partial<PayRow>) {
    setPayRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setDirty(true);
  }
  const numbers = itemNumbers(lines);

  const buildPayload = () => ({
      ...header,
      customerId: header.customerId || undefined,
      saveCustomer,
      discountValue: Number(header.discountValue) || 0,
      paymentPlan: plan,
      installments: Math.min(Math.max(Math.floor(Number(installments) || 1), 1), MAX_INSTALLMENTS),
      paymentTerms: planTerms.map((t) => ({ label: t.label, value: t.value, dueDays: t.dueDays })),
      lines: lines.map((l, i) => ({
        kind: l.kind,
        productId: l.productId,
        code: l.code,
        title: l.title,
        description: l.showDescription ? l.description : null,
        quantity: numeric[i].quantity,
        unit: l.unit,
        unitPrice: numeric[i].unitPrice,
        discountPercent: numeric[i].discountPercent,
      })),
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string>();
  const [previewing, startPreview] = useTransition();
  const preview = () =>
    startPreview(async () => {
      setPreviewError(undefined);
      const res = await previewOffer(companySlug, JSON.stringify(buildPayload()));
      if (res.error || !res.pdf) return setPreviewError(res.error ?? "The preview couldn't be made.");
      const bytes = Uint8Array.from(atob(res.pdf), (c) => c.charCodeAt(0));
      setPreviewUrl(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
    });
  const [state, formAction, pending] = useActionState<OfferFormState, FormData>(async (prev) => {
    const fd = new FormData();
    fd.set("payload", JSON.stringify(buildPayload()));
    if (returnTo) fd.set("returnTo", returnTo);
    return saveOffer(companySlug, offer?.id ?? null, prev, fd);
  }, {});

  return (
    <form
      action={formAction}
      data-save-shortcut
      data-dirty={dirty}
      // Enter moves to the next field (components/enter-keys.tsx) but never posts the document.
      data-enter-no-submit
      className="mt-6 space-y-6"
    >
      {offer?.locked && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This offer has invoices, so its prices and payment schedule are locked. You can still change its status from
          the Offers list. To change it, cancel its invoices or use Duplicate to make a new version.
        </p>
      )}

      {/* Customer + offer details */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-navy">Customer</h2>
            {header.customerId && (
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
              Company / organisation *
              <input
                ref={customerInput}
                value={header.customerName}
                onChange={(e) => {
                  set("customerName", e.target.value);
                  setCustomerOpen(true);
                  setCustomerHighlight(0);
                }}
                onBlur={() => setCustomerOpen(false)}
                onKeyDown={onCustomerKey}
                className={inputClass}
                placeholder="Search saved customers, or type a new name"
                autoComplete="off"
                role="combobox"
                aria-expanded={customerMatches.length > 0}
                aria-controls="customer-matches"
                required
              />
            </label>
            {customerMatches.length > 0 && (
              <ul id="customer-matches" role="listbox" aria-label="Saved customers" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
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
              <input value={header.customerAttention} onChange={(e) => set("customerAttention", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Phone
              <input value={header.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className={labelClass}>
            Email
            <input type="email" value={header.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Address
            <textarea rows={2} value={header.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Vessel
            <select value={header.vesselId} onChange={(e) => set("vesselId", e.target.value)} className={inputClass} aria-label="Vessel">
              <option value="">— No vessel —</option>
              {vessels
                .filter((v) => !header.customerId || v.customerId === header.customerId || v.id === header.vesselId)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
            </select>
          </label>
          {!header.customerId && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={saveCustomer} onChange={(e) => setSaveCustomer(e.target.checked)} />
              Save this customer for next time
            </label>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-navy">Offer</h2>
          <label className={labelClass}>
            Subject
            <input
              value={header.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="e.g. Overhaul of twin diesel engines – patrol vessel"
              className={inputClass}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Customer reference (RFQ / tender)
              <input value={header.reference} onChange={(e) => set("reference", e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Status
              <select value={header.status} onChange={(e) => set("status", e.target.value as OfferStatus)} className={inputClass}>
                {Object.entries(OFFER_STATUSES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Offer date *
              <input type="date" value={header.offerDate} onChange={(e) => set("offerDate", e.target.value)} className={inputClass} required />
            </label>
            <label className={labelClass}>
              Valid until *
              <input type="date" value={header.validUntil} onChange={(e) => set("validUntil", e.target.value)} className={inputClass} required />
            </label>
          </div>
          <label className={labelClass}>
            Protective marking (printed on every page)
            <input
              list="offer-markings"
              value={header.marking}
              onChange={(e) => set("marking", e.target.value.toUpperCase())}
              placeholder="None"
              className={inputClass}
            />
            <datalist id="offer-markings">
              {MARKING_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <p className="text-xs text-muted">Issued by {companyName}. The company is set automatically.</p>
        </div>
      </section>

      <label className={`${labelClass} block`}>
        Introduction (printed above the price table)
        <textarea rows={4} value={header.intro} onChange={(e) => set("intro", e.target.value)} className={inputClass} />
      </label>

      <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="font-semibold text-navy sm:col-span-2 lg:col-span-4">Delivery & warranty (printed on the PDF)</h2>
        <label className={labelClass}>
          Incoterm
          <select value={header.incoterm} onChange={(e) => set("incoterm", e.target.value)} className={inputClass}>
            <option value="">—</option>
            {INCOTERMS.map(([code, name]) => (
              <option key={code} value={code}>
                {code} — {name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Delivery place
          <input value={header.deliveryPlace} onChange={(e) => set("deliveryPlace", e.target.value)} placeholder="e.g. Port of Beirut, Jounieh marina" className={inputClass} />
        </label>
        <label className={labelClass}>
          Lead time
          <input value={header.leadTime} onChange={(e) => set("leadTime", e.target.value)} placeholder="e.g. 4–6 weeks from order" className={inputClass} />
        </label>
        <label className={labelClass}>
          Warranty
          <input value={header.warranty} onChange={(e) => set("warranty", e.target.value)} placeholder="e.g. 12 months parts & labour" className={inputClass} />
        </label>
      </section>

      {/* Lines */}
      <section className="rounded-2xl border border-border bg-surface">
        <div className="relative flex flex-wrap items-center gap-2 border-b border-border p-4">
          <input
            ref={searchInput}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlight(0);
              setPickerOpen(true);
            }}
            onClick={() => setPickerOpen(true)}
            onBlur={() => setPickerOpen(false)}
            onKeyDown={onSearchKey}
            data-shortcut-search
            autoComplete="off"
            placeholder="Click to choose a product or service, or type a name or code  ( / )"
            className={`${inputClass} mt-0 min-w-[16rem] flex-1`}
          />
          <button
            type="button"
            aria-expanded={pickerOpen}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setPickerOpen((o) => !o);
              searchInput.current?.focus();
            }}
            className={secondaryButton}
          >
            Browse products
          </button>
          <button type="button" onClick={() => customLine()} className={secondaryButton}>
            + Custom line
          </button>
          <button type="button" onClick={() => sectionLine()} className={secondaryButton}>
            + Section
          </button>
          <p className="w-full text-xs text-muted">
            <Kbd>Enter</Kbd> adds the selected item, or a custom line with what you typed if nothing matches.{" "}
            <Kbd>Shift Enter</Kbd> adds it as a section heading.
          </p>
          {pickerOpen && !search.trim() && catalogue.length === 0 && (
            <p className="absolute left-4 right-4 top-[3.75rem] z-10 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted shadow-lg">
              No products or services yet. Add them under Stock or Services.
            </p>
          )}
          {suggestions.length > 0 && (
            <ul ref={pickerList} className="absolute left-4 right-4 top-[3.75rem] z-10 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
              {suggestions.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => fromCatalogue(c)}
                    className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm ${i === highlight ? "bg-background" : ""}`}
                  >
                    <span>
                      <span className="mr-2 font-mono text-muted">{c.code}</span>
                      {c.name}
                      <span className="ml-2 rounded bg-background px-1.5 py-0.5 text-[10px] uppercase text-muted">
                        {c.type === "SERVICE" ? "Service" : "Product"}
                      </span>
                    </span>
                    <span className="text-muted">
                      {formatMoney(c.priceHT)} / {c.unit}
                    </span>
                  </button>
                </li>
              ))}
              {matching.length > MAX_PICKER_ROWS && (
                <li className="px-3 py-2 text-xs text-muted">
                  Showing {MAX_PICKER_ROWS} of {matching.length}. Type a name or code to find the rest.
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-3 py-3">#</th>
                <th className="px-3 py-3">Description</th>
                <th className="w-24 px-3 py-3 text-right">Qty</th>
                <th className="w-24 px-3 py-3">Unit</th>
                <th className="w-32 px-3 py-3 text-right">Unit price</th>
                <th className="w-24 px-3 py-3 text-right">Disc. %</th>
                <th className="w-32 px-3 py-3 text-right">Amount</th>
                <th className="w-28 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
                    No lines yet. Search above, or add a custom line or a section.
                  </td>
                </tr>
              )}
              {lines.map((line, i) => {
                const controls = (
                  <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                    <button type="button" onClick={() => move(i, -1)} className="rounded px-1.5 py-1 text-muted hover:bg-background" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => move(i, 1)} className="rounded px-1.5 py-1 text-muted hover:bg-background" aria-label="Move down">↓</button>
                    <button
                      type="button"
                      onClick={() => {
                        setLines((ls) => ls.filter((l) => l.key !== line.key));
                        setDirty(true);
                      }}
                      className="rounded px-1.5 py-1 text-muted hover:bg-red-50 hover:text-danger"
                      aria-label="Remove line"
                    >
                      ×
                    </button>
                  </td>
                );

                if (line.kind === "SECTION") {
                  return (
                    <tr key={line.key} className="bg-background/70">
                      <td className="px-3 py-2 text-xs font-semibold uppercase text-muted">§</td>
                      <td colSpan={6} className="px-3 py-2">
                        <input
                          value={line.title}
                          onChange={(e) => updateLine(line.key, { title: e.target.value })}
                          placeholder="Section heading, e.g. PART A – ENGINE OVERHAUL"
                          className={`${cell} font-semibold uppercase tracking-wide`}
                          aria-label="Section heading"
                        />
                      </td>
                      {controls}
                    </tr>
                  );
                }

                const itemNo = numbers[i];
                return (
                  <tr key={line.key} className="align-top">
                    <td className="px-3 py-3 text-muted">{itemNo}</td>
                    <td className="space-y-1.5 px-3 py-2">
                      <input
                        value={line.title}
                        onChange={(e) => updateLine(line.key, { title: e.target.value })}
                        placeholder="Line title"
                        className={`${cell} font-medium`}
                        aria-label={`Title of line ${itemNo}`}
                      />
                      {line.showDescription ? (
                        <textarea
                          rows={2}
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                          placeholder="Details printed under the title"
                          className={`${cell} text-xs`}
                          aria-label={`Details of line ${itemNo}`}
                        />
                      ) : (
                        <button type="button" onClick={() => updateLine(line.key, { showDescription: true })} className="text-xs text-brand hover:underline">
                          + details
                        </button>
                      )}
                      {line.code && <p className="font-mono text-[11px] text-muted">Ref. {line.code}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} className={`${cell} text-right`} aria-label={`Quantity of line ${itemNo}`} />
                    </td>
                    <td className="px-3 py-2">
                      <input list="offer-units" value={line.unit} onChange={(e) => updateLine(line.key, { unit: e.target.value })} className={cell} aria-label={`Unit of line ${itemNo}`} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })} className={`${cell} text-right`} aria-label={`Unit price of line ${itemNo}`} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" max="100" step="0.01" value={line.discountPercent} onChange={(e) => updateLine(line.key, { discountPercent: e.target.value })} placeholder="0" className={`${cell} text-right`} aria-label={`Discount of line ${itemNo}`} />
                    </td>
                    <td className="px-3 py-3 text-right font-medium">{formatMoney(lineTotal(numeric[i]))}</td>
                    {controls}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="offer-units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </section>

      {/* Payment schedule */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-navy">Payment terms</h2>
          <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Payment plan">
            {(Object.keys(PAYMENT_PLANS) as PaymentPlan[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={plan === key}
                onClick={() => choosePlan(key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${plan === key ? "bg-navy text-white" : "text-navy hover:bg-background"}`}
              >
                {PAYMENT_PLANS[key]}
              </button>
            ))}
          </div>
        </div>

        {plan === "PERCENT" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Quick split:</span>
            {PERCENT_PRESETS.map((split) => (
              <button
                key={split.join("/")}
                type="button"
                onClick={() => {
                  setPayRows(toRows(percentTerms(split)));
                  setDirty(true);
                }}
                className="rounded-md border border-border px-2 py-1 hover:bg-background"
              >
                {split.join(" / ")}
              </button>
            ))}
          </div>
        )}
        {plan === "INSTALLMENTS" && (
          <label className="mt-3 flex items-center gap-2 text-sm text-navy">
            Number of equal payments
            <input
              type="number"
              min="1"
              max={MAX_INSTALLMENTS}
              value={installments}
              onChange={(e) => setInstallmentCount(e.target.value)}
              className="w-20 rounded-md border border-border px-2 py-1 text-right"
              aria-label="Number of payments"
            />
          </label>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 py-2 pr-2">#</th>
                <th className="py-2 pr-2">Description</th>
                <th className="w-28 py-2 pr-2 text-right">Share</th>
                <th className="w-36 py-2 pr-2 text-right">Amount incl. VAT</th>
                <th className="w-40 py-2 pr-2">Due (days after invoice)</th>
                <th className="w-10 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedule.payments.map((payment, i) => (
                <tr key={i}>
                  <td className="py-2 pr-2 text-muted">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <input
                      value={payRows[i]?.label ?? payment.label}
                      onChange={(e) => updatePayRow(i, { label: e.target.value })}
                      className={cell}
                      aria-label={`Description of payment ${i + 1}`}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {plan === "PERCENT" ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={payRows[i]?.value ?? ""}
                          onChange={(e) => updatePayRow(i, { value: e.target.value })}
                          className={`${cell} w-20 text-right`}
                          aria-label={`Percentage of payment ${i + 1}`}
                        />
                        %
                      </span>
                    ) : (
                      <span className="text-muted">{Math.round(payment.percent * 100) / 100}%</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right font-medium">{formatMoney(payment.amount)}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={payRows[i]?.dueDays ?? "0"}
                      onChange={(e) => updatePayRow(i, { dueDays: e.target.value })}
                      className={`${cell} w-24 text-right`}
                      aria-label={`Due days of payment ${i + 1}`}
                    />
                  </td>
                  <td className="py-2 text-right">
                    {plan === "PERCENT" && schedule.payments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayRows((rows) => rows.filter((_, j) => j !== i));
                          setDirty(true);
                        }}
                        className="rounded px-1.5 py-1 text-muted hover:bg-red-50 hover:text-danger"
                        aria-label={`Remove payment ${i + 1}`}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          {plan === "PERCENT" ? (
            <button
              type="button"
              onClick={() => {
                const left = Math.max(0, Math.round((100 - schedule.percentTotal) * 10000) / 10000);
                setPayRows((rows) => [...rows, { label: `Payment ${rows.length + 1}`, value: String(left), dueDays: "0" }]);
                setDirty(true);
              }}
              className="text-brand hover:underline"
            >
              + Add payment
            </button>
          ) : (
            <span className="text-muted">Amounts are calculated from the offer total.</span>
          )}
          {problem ? (
            <span className="font-medium text-danger">{problem}</span>
          ) : (
            <span className="font-medium text-success">✓ Adds up to {formatMoney(totals.totalTTC)}</span>
          )}
        </div>
      </section>

      {/* Terms + totals */}
      <section className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          {clauses.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              Insert a standard clause:
              <select
                value=""
                onChange={(e) => {
                  const c = clauses.find((x) => x.id === e.target.value);
                  if (c) set("terms", header.terms.trim() ? `${header.terms.trimEnd()}\n${c.text}` : c.text);
                }}
                className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
                aria-label="Insert a standard clause"
              >
                <option value="">Choose…</option>
                {clauses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={`${labelClass} block`}>
            Terms and conditions (one per line, numbered on the PDF)
            <textarea rows={7} value={header.terms} onChange={(e) => set("terms", e.target.value)} className={inputClass} />
          </label>
          <label className={`${labelClass} block`}>
            Internal notes (never printed)
            <textarea rows={2} value={header.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="h-fit rounded-2xl border border-border bg-surface p-5 text-sm">
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Discount</dt>
              <dd className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={header.discountValue}
                  onChange={(e) => set("discountValue", e.target.value)}
                  placeholder="0"
                  className="w-24 rounded-md border border-border px-2 py-1 text-right"
                  aria-label="Overall discount"
                />
                <select
                  value={header.discountType}
                  onChange={(e) => set("discountType", e.target.value as DiscountType)}
                  className="rounded-md border border-border px-1.5 py-1"
                  aria-label="Discount type"
                >
                  <option value="PERCENT">%</option>
                  <option value="AMOUNT">$</option>
                </select>
              </dd>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex justify-between text-muted">
                <dt />
                <dd>− {formatMoney(totals.discountTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-medium">
              <dt>Total excl. VAT</dt>
              <dd>{formatMoney(totals.totalHT)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>
                <label className="flex items-center gap-2 text-muted">
                  <input type="checkbox" checked={header.applyVat} onChange={(e) => set("applyVat", e.target.checked)} />
                  VAT {VAT_RATE * 100}%
                </label>
              </dt>
              <dd>{header.applyVat ? formatMoney(totals.vatAmount) : "Exempt"}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-navy">
              <dt>Total</dt>
              <dd>{formatMoney(totals.totalTTC)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs italic text-muted">{amountInWords(totals.totalTTC)}</p>

          <div className="mt-4">
            <FormMessage error={state.error ?? previewError} />
          </div>
        </div>
      </section>

      <StickyActions
        summary={
          <span>
            {lines.filter((l) => l.kind === "ITEM").length} line(s) · Total{" "}
            <span className="tabular text-base font-semibold text-navy">{formatMoney(totals.totalTTC)}</span>
            {problem && <span className="ml-3 text-danger">{problem}</span>}
          </span>
        }
      >
        <Link href={returnTo ?? `/c/${companySlug}/offers`} scroll={!returnTo} className={secondaryButton}>
          Cancel
        </Link>
        <button type="button" onClick={preview} disabled={previewing} className={secondaryButton}>
          {previewing ? "Preparing…" : "Preview PDF"}
        </button>
        <button type="submit" disabled={pending || offer?.locked} className={primaryButton}>
          {pending ? "Saving…" : offer?.locked ? "Locked (invoiced)" : offer ? "Save changes" : "Save offer"}
          <Kbd className="border-white/20 bg-white/10 text-white/80">Ctrl S</Kbd>
        </button>
      </StickyActions>
      {previewUrl && (
        <Modal title="Preview (not saved yet)" onClose={() => setPreviewUrl(null)} size="xl">
          <iframe src={previewUrl} title="Offer preview" className="h-[75vh] w-full rounded-lg border border-border" />
        </Modal>
      )}
    </form>
  );
}
