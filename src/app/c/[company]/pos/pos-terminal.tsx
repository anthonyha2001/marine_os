"use client";

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, ImageOff, Minus, Plus, Printer, ScanBarcode, Trash2, UserRound } from "lucide-react";
import { completeSale, type CompleteSaleResult } from "@/lib/actions/pos";
import type { PosProduct } from "@/lib/data/pos";
import { formatMoney, round2, withVat } from "@/lib/money";
import { ceilLbp, formatLbp, saleTotals, settle, type ChangeCurrency, type PosRules } from "@/lib/pos";
import { useFeedback } from "@/components/feedback";
import { Modal } from "@/components/modal";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, cardClass, inputClass, labelClass, primaryButton, secondaryButton, secondaryButtonSm } from "@/components/ui";

type CartItem = { productId: string; code: string; name: string; priceHT: number; quantity: number; stock: number };
type Customer = { id: string; name: string; taxNumber: string | null };

// "Print automatically" is a per-till preference kept in this browser.
const AUTO_PRINT_KEY = "pos:autoprint";
const autoPrintListeners = new Set<() => void>();
function readAutoPrint() {
  try {
    return localStorage.getItem(AUTO_PRINT_KEY) !== "0";
  } catch {
    return true;
  }
}
function writeAutoPrint(on: boolean) {
  try {
    localStorage.setItem(AUTO_PRINT_KEY, on ? "1" : "0");
  } catch {}
  autoPrintListeners.forEach((l) => l());
}
const subscribeAutoPrint = (l: () => void) => {
  autoPrintListeners.add(l);
  return () => autoPrintListeners.delete(l);
};

/** "3*oil filter" or "3* 6291041500213": a quantity, a star, then the product. */
function splitQuantity(text: string) {
  const m = /^\s*(\d{1,4})\s*\*\s*(.*)$/.exec(text);
  return m && Number(m[1]) > 0 ? { qty: Number(m[1]), term: m[2] } : { qty: 1, term: text };
}

const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(/,/g, "")) || 0);

/** Print a page in a hidden frame (no pop-up window to block). */
function printInFrame(url: string) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  document.body.appendChild(frame);
  frame.addEventListener("load", () => setTimeout(() => window.focus(), 0));
  setTimeout(() => frame.remove(), 60_000);
}

export function PosTerminal({
  companySlug,
  products,
  customers,
  rate,
  rules,
}: {
  companySlug: string;
  products: PosProduct[];
  customers: Customer[];
  rate: number;
  /** The till settings as they apply to the person at the till. */
  rules: PosRules;
}) {
  const maxDiscount = rules.maxDiscountPct;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [discount, setDiscount] = useState("");
  const [paidUsd, setPaidUsd] = useState("");
  const [paidLbp, setPaidLbp] = useState("");
  const [paidCard, setPaidCard] = useState("");
  const [changeCurrency, setChangeCurrency] = useState<ChangeCurrency>("USD");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerTax, setCustomerTax] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<CompleteSaleResult & { totalTTC: number }>();
  const autoPrint = useSyncExternalStore(subscribeAutoPrint, readAutoPrint, () => true);
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();
  const scanRef = useFocusOnShow<HTMLInputElement>();
  const usdRef = useRef<HTMLInputElement>(null);

  const base = `/c/${companySlug}/pos`;
  const { qty: typedQty, term } = splitQuantity(query);
  const hasQty = term !== query;
  const q = term.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.code.startsWith(q) || p.barcodes.some((b) => b.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [products, q]);

  const discountPct = Math.min(num(discount), 100);
  const totals = saleTotals(cart.map((c) => ({ unitPriceHT: c.priceHT, quantity: c.quantity })), discountPct);
  const pay = settle({ totalTTC: totals.totalTTC, rate, paidUsd: num(paidUsd), paidLbp: num(paidLbp), paidCard: num(paidCard), changeCurrency, cardOverpay: rules.cardOverpay });
  const totalLbp = ceilLbp(totals.totalTTC * rate);
  const discountTooHigh = discountPct > maxDiscount;
  const overStock = !rules.sellOutOfStock && cart.some((c) => c.quantity > c.stock);
  const needsCustomer = rules.customerRequiredAbove > 0 && totals.totalTTC > rules.customerRequiredAbove && !customerId && !customerName.trim();
  const canComplete = cart.length > 0 && pay.ok && !discountTooHigh && !overStock && !needsCustomer && !pending && !done;

  const add = (p: PosProduct, qty = typedQty) => {
    setCart((items) => {
      const existing = items.find((i) => i.productId === p.id);
      if (existing) return items.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + qty } : i));
      return [...items, { productId: p.id, code: p.code, name: p.name, priceHT: p.priceHT, quantity: qty, stock: p.stock }];
    });
    setQuery("");
    setHighlight(0);
  };

  const onScanKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const raw = term.trim();
      if (!raw) {
        if (hasQty) toast.error(`Now type or scan the product to add ${typedQty}.`);
        else if (cart.length) usdRef.current?.focus();
        return;
      }
      // A scanner types the barcode then Enter: exact barcode or code first.
      const exact = products.find((p) => p.barcodes.includes(raw) || p.code === raw);
      const pick = exact ?? results[highlight];
      if (pick) add(pick);
      else toast.error(`No product matches “${raw}”.`);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  const setQty = (id: string, quantity: number) =>
    setCart((items) => (quantity <= 0 ? items.filter((i) => i.productId !== id) : items.map((i) => (i.productId === id ? { ...i, quantity } : i))));

  const reset = () => {
    setCart([]);
    setDiscount("");
    setPaidUsd("");
    setPaidLbp("");
    setPaidCard("");
    setChangeCurrency("USD");
    setCustomerOpen(false);
    setCustomerId("");
    setCustomerName("");
    setCustomerTax("");
    setError(undefined);
    setDone(undefined);
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  const submit = () => {
    if (done) {
      reset();
      return;
    }
    if (!canComplete) return;
    setError(undefined);
    startTransition(async () => {
      try {
        const res = await completeSale(companySlug, {
          lines: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
          discountPct,
          customerId: customerId || null,
          customerName: customerId ? undefined : customerName,
          customerTaxNumber: customerId ? undefined : customerTax,
          paidUsd: pay.paidUsd,
          paidLbp: pay.paidLbp,
          paidCard: pay.paidCard,
          changeCurrency,
          rate,
        });
        if (res.error || !res.saleId) {
          setError(res.error ?? "The sale couldn't be saved.");
          return;
        }
        setDone({ ...res, totalTTC: totals.totalTTC });
        if (autoPrint) printInFrame(`${base}/sales/${res.saleId}/receipt?print=1`);
      } catch {
        setError("The sale couldn't be saved. Check your connection and try again.");
      }
    });
  };

  const exact = (kind: "usd" | "lbp" | "card") => {
    setPaidUsd(kind === "usd" ? String(totals.totalTTC) : "");
    setPaidLbp(kind === "lbp" ? String(totalLbp) : "");
    setPaidCard(kind === "card" ? String(totals.totalTTC) : "");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-save-shortcut
      data-dirty={cart.length > 0 && !done ? "true" : undefined}
      className="grid gap-5 xl:grid-cols-[1fr_26rem]"
    >
      {/* Left: scan + cart */}
      <section className="min-w-0 space-y-4">
        <div className="relative">
          <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-brand" aria-hidden />
          <input
            ref={scanRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onScanKey}
            disabled={!!done}
            aria-label="Scan a barcode or search a product"
            placeholder="Scan a barcode, or type a name or code…  (3* first for 3 pieces)"
            autoComplete="off"
            className="h-14 w-full rounded-xl border border-border bg-surface pl-12 pr-4 text-lg shadow-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          {hasQty && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-navy px-2.5 py-1 text-sm font-semibold text-white" aria-live="polite">
              × {typedQty}
            </span>
          )}
          {results.length > 0 && (
            <ul role="listbox" aria-label="Matching products" className={`${cardClass} absolute inset-x-0 top-full z-20 mt-1 overflow-hidden py-1 shadow-lg`}>
              {results.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(p)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${i === highlight ? "bg-brand-soft" : "hover:bg-surface-2"}`}
                  >
                    <span className="min-w-0">
                      {hasQty && <span className="mr-1.5 font-semibold text-brand">{typedQty} ×</span>}
                      <span className="font-mono text-xs text-muted">{p.code}</span> <span className="font-medium text-navy">{p.name}</span>
                      <span className={`ml-2 text-xs ${p.stock > 0 ? "text-muted" : "text-danger"}`}>{p.stock} in stock</span>
                    </span>
                    <span className="tabular font-semibold text-navy">{formatMoney(withVat(p.priceHT))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${cardClass} overflow-hidden`}>
          {cart.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                <ScanBarcode className="size-6" aria-hidden />
              </span>
              <p className="mt-4 font-semibold text-navy">Scan the first product</p>
              <p className="mt-1 text-sm text-muted">Scanning the same item again adds one more. Type 3* before it for 3.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-2 py-2.5 text-right">Price</th>
                  <th className="px-2 py-2.5 text-center">Qty</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cart.map((c) => (
                  <tr
                    key={c.productId}
                    onDoubleClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, input")) return;
                      window.getSelection()?.removeAllRanges();
                      setDetailId(c.productId);
                    }}
                    title="Double-click to see the item and its photo"
                    className="cursor-pointer hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => setDetailId(c.productId)} className="text-left font-medium text-navy hover:text-brand">
                        {c.name}
                      </button>
                      <span className="block text-xs text-muted">
                        <span className="font-mono">{c.code}</span>
                        {c.quantity > c.stock && <span className="ml-2 font-medium text-amber-700">Only {Math.max(c.stock, 0)} in stock</span>}
                      </span>
                    </td>
                    <td className="tabular px-2 py-2.5 text-right">{formatMoney(withVat(c.priceHT))}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" disabled={!!done} onClick={() => setQty(c.productId, c.quantity - 1)} aria-label={`One less ${c.name}`} className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-surface-2">
                          <Minus className="size-3.5" aria-hidden />
                        </button>
                        <input
                          value={c.quantity}
                          disabled={!!done}
                          onChange={(e) => setQty(c.productId, Math.max(0, Math.floor(num(e.target.value))))}
                          inputMode="numeric"
                          aria-label={`Quantity of ${c.name}`}
                          className="h-8 w-12 rounded-md border border-border text-center tabular"
                        />
                        <button type="button" disabled={!!done} onClick={() => setQty(c.productId, c.quantity + 1)} aria-label={`One more ${c.name}`} className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-surface-2">
                          <Plus className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                    <td className="tabular px-4 py-2.5 text-right font-semibold text-navy">{formatMoney(round2(withVat(c.priceHT) * c.quantity))}</td>
                    <td className="pr-2 text-right">
                      <button type="button" disabled={!!done} onClick={() => setQty(c.productId, 0)} title="Remove" aria-label={`Remove ${c.name}`} className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-danger">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={`${cardClass} p-4`}>
          <button type="button" onClick={() => setCustomerOpen((o) => !o)} className="flex items-center gap-2 text-sm font-medium text-navy">
            <UserRound className="size-4 text-brand" aria-hidden />
            {customerId ? customers.find((c) => c.id === customerId)?.name : customerName || "Walk-in customer"}
            <span className="text-xs font-normal text-brand">{customerOpen ? "Hide" : "Change"}</span>
          </button>
          {customerOpen && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                Saved customer
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
                  <option value="">— Walk-in / type below —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Name
                <input value={customerName} disabled={!!customerId} onChange={(e) => setCustomerName(e.target.value)} maxLength={200} className={inputClass} />
              </label>
              <label className={labelClass}>
                VAT number
                <input value={customerTax} disabled={!!customerId} onChange={(e) => setCustomerTax(e.target.value)} maxLength={100} className={inputClass} />
              </label>
            </div>
          )}
        </div>
      </section>

      {/* Right: totals + payment */}
      <aside className="space-y-4">
        <div className={`${cardClass} p-5`}>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal excl. VAT</dt>
              <dd className="tabular">{formatMoney(totals.subtotalHT)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">
                <label htmlFor="pos-discount">Discount %</label>
              </dt>
              <dd className="flex items-center gap-2">
                <input
                  id="pos-discount"
                  value={discount}
                  disabled={!!done}
                  onChange={(e) => setDiscount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className={`h-8 w-16 rounded-md border px-2 text-right tabular ${discountTooHigh ? "border-danger" : "border-border"}`}
                />
                <span className="tabular w-24 text-right">− {formatMoney(totals.discountHT)}</span>
              </dd>
            </div>
            {discountTooHigh && <p className="text-xs text-danger">{maxDiscount > 0 ? `At most ${maxDiscount}% without a manager.` : "Discounts need a manager."}</p>}
            <div className="flex justify-between">
              <dt className="text-muted">VAT 11%</dt>
              <dd className="tabular">{formatMoney(totals.vatAmount)}</dd>
            </div>
          </dl>
          <div className="mt-3 rounded-lg bg-navy px-4 py-3 text-white">
            <p className="text-xs uppercase tracking-wider text-white/70">Total</p>
            <p className="tabular text-3xl font-semibold" data-testid="pos-total">
              {formatMoney(totals.totalTTC)}
            </p>
            <p className="tabular text-sm text-white/80">{formatLbp(totalLbp)}</p>
          </div>
        </div>

        <div className={`${cardClass} space-y-3 p-5`}>
          <div className="flex gap-2 [&>*]:flex-1">
            {rules.allowUsd && (
              <button type="button" disabled={!cart.length || !!done} onClick={() => exact("usd")} className={secondaryButtonSm}>
                Exact $
              </button>
            )}
            {rules.allowLbp && (
              <button type="button" disabled={!cart.length || !!done} onClick={() => exact("lbp")} className={secondaryButtonSm}>
                Exact LBP
              </button>
            )}
            {rules.allowCard && (
              <button type="button" disabled={!cart.length || !!done} onClick={() => exact("card")} className={secondaryButtonSm}>
                All by card
              </button>
            )}
          </div>
          {rules.allowUsd && (
            <label className={labelClass}>
              Cash USD received
              <input ref={usdRef} value={paidUsd} disabled={!!done} onChange={(e) => setPaidUsd(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${inputClass} tabular text-right text-lg`} />
            </label>
          )}
          {rules.allowLbp && (
            <label className={labelClass}>
              Cash LBP received
              <input value={paidLbp} disabled={!!done} onChange={(e) => setPaidLbp(e.target.value)} inputMode="numeric" placeholder="0" className={`${inputClass} tabular text-right text-lg`} />
            </label>
          )}
          {rules.allowCard && (
            <label className={labelClass}>
              Card (USD)
              <input value={paidCard} disabled={!!done} onChange={(e) => setPaidCard(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${inputClass} tabular text-right text-lg`} />
            </label>
          )}
          {pay.cardTooHigh && <p className="text-xs text-danger">The card amount can&apos;t be more than the total.</p>}
          {rules.cardOverpay === "CHANGE" && num(paidCard) > totals.totalTTC + 0.004 && (
            <p className="text-xs text-amber-700">The card is more than the total: give the difference back in cash.</p>
          )}
          {overStock && <p className="text-xs text-danger">Some quantities are more than the stock. Lower them or ask a manager.</p>}
          {needsCustomer && <p className="text-xs text-danger">Enter the customer&apos;s name for sales above {formatMoney(rules.customerRequiredAbove)}.</p>}

          {cart.length > 0 && !done && (
            <div className="rounded-lg bg-background p-3 text-sm" aria-live="polite">
              {pay.remaining > 0 ? (
                <p>
                  Still to pay: <span className="tabular font-semibold text-danger">{formatMoney(pay.remaining)}</span>{" "}
                  <span className="text-muted">or {formatLbp(pay.remainingLbp)}</span>
                </p>
              ) : pay.changeUsd > 0 || pay.changeLbp > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    Change: <span className="tabular text-lg font-semibold text-success" data-testid="pos-change">{changeCurrency === "USD" ? formatMoney(pay.changeUsd) : formatLbp(pay.changeLbp)}</span>
                  </p>
                  <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs" role="group" aria-label="Give change in">
                    {(["USD", "LBP"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={changeCurrency === c}
                        onClick={() => setChangeCurrency(c)}
                        className={`rounded px-2 py-1 font-medium ${changeCurrency === c ? "bg-navy text-white" : "text-muted"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="font-medium text-success">Paid exactly.</p>
              )}
            </div>
          )}

          <FormMessage error={error} />

          {done ? (
            <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4" role="status">
              <p className="flex items-center gap-2 font-semibold text-success">
                <CheckCircle2 className="size-5" aria-hidden /> Sale {done.number} saved
              </p>
              {(done.changeUsd ?? 0) > 0 && <p className="text-sm">Give back {formatMoney(done.changeUsd ?? 0)}</p>}
              {(done.changeLbp ?? 0) > 0 && <p className="text-sm">Give back {formatLbp(done.changeLbp ?? 0)}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => printInFrame(`${base}/sales/${done.saleId}/receipt?print=1`)} className={secondaryButtonSm}>
                  <Printer className="size-3.5" aria-hidden /> Print receipt
                </button>
                <a href={`${base}/sales/${done.saleId}/invoice`} target="_blank" rel="noopener" className={secondaryButtonSm}>
                  <FileText className="size-3.5" aria-hidden /> Tax invoice (A4)
                </a>
                <Link href={`${base}/sales/${done.saleId}`} className={secondaryButtonSm}>
                  Details
                </Link>
              </div>
              {/* Focus here so Enter / Ctrl+S start the next sale straight away. */}
              <button type="submit" autoFocus className={`${primaryButton} w-full gap-2`}>
                New sale <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
              </button>
            </div>
          ) : (
            <button type="submit" disabled={!canComplete} className={`${primaryButton} h-12 w-full gap-2 text-base`}>
              {pending ? "Saving…" : "Complete sale"}
              <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
            </button>
          )}
          {!done && cart.length > 0 && (
            <button type="button" onClick={reset} className={`${secondaryButton} w-full`}>
              Clear sale
            </button>
          )}
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => writeAutoPrint(e.target.checked)}
              className="size-3.5 accent-brand"
            />
            Print the receipt automatically
          </label>
        </div>
      </aside>

      {detailId && (
        <ItemDetails
          product={products.find((p) => p.id === detailId)}
          inCart={cart.find((c) => c.productId === detailId)?.quantity ?? 0}
          onQty={done ? undefined : (n) => setQty(detailId, n)}
          onClose={() => {
            setDetailId(null);
            setTimeout(() => scanRef.current?.focus(), 0);
          }}
        />
      )}
    </form>
  );
}

/** What the cashier checks before handing the item over: the photo, the code, the price. */
function ItemDetails({ product, inCart, onQty, onClose }: { product?: PosProduct; inCart: number; onQty?: (n: number) => void; onClose: () => void }) {
  if (!product) return null;
  return (
    <Modal title={product.name} onClose={onClose} size="lg">
      <div className="grid gap-5 sm:grid-cols-[16rem_1fr]">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- product photos are stored as plain URLs
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-2 p-4 text-center text-xs text-muted">
              <ImageOff className="size-8" aria-hidden />
              No photo yet. Add one in Stock → the product.
            </span>
          )}
        </div>
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Code</dt>
              <dd className="font-mono font-semibold text-navy">{product.code}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Price (incl. VAT)</dt>
              <dd className="tabular text-lg font-semibold text-navy">{formatMoney(withVat(product.priceHT))}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">In stock</dt>
              <dd className={`font-semibold ${product.stock > 0 ? "text-navy" : "text-danger"}`}>{product.stock}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Barcode</dt>
              <dd className="font-mono text-navy">{product.barcodes.join(", ") || "—"}</dd>
            </div>
          </dl>
          {product.description && <p className="whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm text-slate-700">{product.description}</p>}
          {onQty && (
            <div className="flex items-center gap-3 border-t border-border pt-4">
              <span className="text-sm text-muted">In this sale</span>
              <button type="button" onClick={() => onQty(inCart - 1)} aria-label="One less" className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-surface-2">
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="tabular w-8 text-center text-lg font-semibold text-navy">{inCart}</span>
              <button type="button" onClick={() => onQty(inCart + 1)} aria-label="One more" className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-surface-2">
                <Plus className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={onClose} className={`${primaryButton} ml-auto`} autoFocus>
                OK
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
