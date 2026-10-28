"use client";

import { useMemo, useRef, useState } from "react";
import type { QuickProduct } from "@/lib/actions/products";
import { formatMoney, round2 } from "@/lib/money";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { Kbd, inputClass, secondaryButton } from "@/components/ui";

// Product lines shared by purchase orders and purchases: scan or search to add,
// edit quantity and price, and create a product that isn't in the catalogue yet.

export type CatalogueItem = { id: string; code: string; name: string; priceHT: number; barcodes: string[]; supplierId?: string | null };
export type OrderRow = { key: number; productId: string; quantity: string; unitPriceHT: string };
export type InitialRow = { productId: string; quantity: number; unitPriceHT: number };

const cellInput =
  "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-right text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function useOrderLines(initialCatalogue: CatalogueItem[], initialRows: InitialRow[] = []) {
  const [catalogue, setCatalogue] = useState(initialCatalogue);
  const [rows, setRows] = useState<OrderRow[]>(() =>
    initialRows.map((r, i) => ({ key: i + 1, productId: r.productId, quantity: String(r.quantity), unitPriceHT: String(r.unitPriceHT) })),
  );
  const nextKey = useRef(initialRows.length + 1);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const searchInput = useFocusOnShow<HTMLInputElement>();

  const byId = useMemo(() => new Map(catalogue.map((p) => [p.id, p])), [catalogue]);
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return catalogue
      .filter((p) => p.name.toLowerCase().includes(q) || p.code.startsWith(q) || p.barcodes.some((b) => b.includes(q)))
      .slice(0, 8);
  }, [search, catalogue]);

  const numeric = rows.map((r) => ({ quantity: Number(r.quantity) || 0, unitPriceHT: Number(r.unitPriceHT) || 0 }));

  function addProduct(product: CatalogueItem) {
    setRows((current) => {
      const existing = current.find((r) => r.productId === product.id);
      if (existing) {
        return current.map((r) => (r === existing ? { ...r, quantity: String((Number(r.quantity) || 0) + 1) } : r));
      }
      return [...current, { key: nextKey.current++, productId: product.id, quantity: "1", unitPriceHT: String(product.priceHT) }];
    });
    setSearch("");
    setHighlight(0);
    searchInput.current?.focus();
  }

  /**
   * Add every product of a supplier that isn't on the order yet, at quantity 0, so the user
   * only types the quantities they want. Returns how many lines were added.
   */
  function addSupplierProducts(supplierId: string) {
    const present = new Set(rows.map((r) => r.productId));
    const toAdd = catalogue.filter((p) => p.supplierId === supplierId && !present.has(p.id));
    setRows((current) => [
      ...current,
      ...toAdd.map((p) => ({ key: nextKey.current++, productId: p.id, quantity: "0", unitPriceHT: String(p.priceHT) })),
    ]);
    return toAdd.length;
  }

  /** A product just created in the pop-up: add it to the catalogue and to the lines. */
  function addCreated(product: QuickProduct) {
    setCatalogue((c) => [...c, product].sort((a, b) => a.name.localeCompare(b.name)));
    addProduct(product);
  }

  const state = {
    catalogue,
    rows,
    setRows,
    byId,
    numeric,
    search,
    setSearch,
    highlight,
    setHighlight,
    suggestions,
    addProduct,
    addCreated,
    addSupplierProducts,
    updateRow: (key: number, patch: Partial<OrderRow>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r))),
    removeRow: (key: number) => setRows((cur) => cur.filter((r) => r.key !== key)),
    /** Lines to save; lines left at quantity 0 are dropped. */
    payloadItems: () =>
      rows
        .map((r) => ({ productId: r.productId, quantity: Number(r.quantity), unitPriceHT: Number(r.unitPriceHT) }))
        .filter((r) => r.quantity > 0),
  };
  // The scan-box ref is returned separately: values read during render must not hold a ref.
  return [state, searchInput] as const;
}

export type OrderLinesState = ReturnType<typeof useOrderLines>[0];
type SearchRef = ReturnType<typeof useOrderLines>[1];

/**
 * Search box + lines table. Enter adds the exact code/barcode match or the highlighted
 * suggestion; if nothing matches, it asks to create the product (onCreateProduct).
 */
export function OrderLinesTable({
  lines,
  searchInput,
  onCreateProduct,
  allowZero = false,
}: {
  lines: OrderLinesState;
  searchInput: SearchRef;
  onCreateProduct: (name: string) => void;
  /** Purchase orders: lines may sit at 0 (e.g. after loading a supplier's products). */
  allowZero?: boolean;
}) {
  const [notFound, setNotFound] = useState("");
  const { search, suggestions, highlight, catalogue } = lines;

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") lines.setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    if (e.key === "ArrowUp") lines.setHighlight((h) => Math.max(h - 1, 0));
    if (e.key !== "Enter") return;
    const q = search.trim();
    if (!q) return;
    // An exact barcode or code match wins (that's what a scanner sends).
    const exact = catalogue.find((p) => p.code === q || p.barcodes.includes(q));
    const pick = exact ?? suggestions[highlight];
    if (pick) {
      lines.addProduct(pick);
      setNotFound("");
    } else {
      setNotFound(q);
      onCreateProduct(q);
    }
  }

  // Enter on a quantity/price cell goes back to the scan box for the next product.
  const backToSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") searchInput.current?.focus();
  };

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="relative flex flex-wrap items-center gap-2 border-b border-border p-4">
        <input
          ref={searchInput}
          value={search}
          onChange={(e) => {
            lines.setSearch(e.target.value);
            lines.setHighlight(0);
            setNotFound("");
          }}
          onKeyDown={onSearchKey}
          data-shortcut-search
          placeholder="Scan a barcode, or type a product name or code…  ( / )"
          className={`${inputClass} mt-0 min-w-[16rem] flex-1`}
        />
        <button type="button" onClick={() => onCreateProduct(search.trim())} className={secondaryButton}>
          + New product
        </button>
        <p className="w-full text-xs text-muted">
          <Kbd>Enter</Kbd> adds the product. Not in the list? Enter opens a pop-up to create it, and it&apos;s added right away.
        </p>
        {suggestions.length > 0 && (
          <ul className="absolute left-4 right-4 top-[3.75rem] z-10 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            {suggestions.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseEnter={() => lines.setHighlight(i)}
                  onClick={() => lines.addProduct(p)}
                  className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm ${i === highlight ? "bg-background" : ""}`}
                >
                  <span>
                    <span className="mr-2 font-mono text-muted">{p.code}</span>
                    {p.name}
                  </span>
                  <span className="text-muted">{formatMoney(p.priceHT)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {notFound && <p className="w-full text-xs text-muted">“{notFound}” isn&apos;t in the catalogue yet.</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="w-20 px-4 py-3">Code</th>
              <th className="px-4 py-3">Product</th>
              <th className="w-28 px-4 py-3 text-right">Quantity</th>
              <th className="w-36 px-4 py-3 text-right">Unit price excl. VAT</th>
              <th className="w-32 px-4 py-3 text-right">Line total</th>
              <th className="w-12 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No products yet. Scan or search above to add lines.
                </td>
              </tr>
            )}
            {lines.rows.map((row, i) => {
              const product = lines.byId.get(row.productId);
              const name = product?.name ?? "Unknown product";
              const zero = (Number(row.quantity) || 0) <= 0;
              return (
                <tr key={row.key} className={allowZero && zero ? "bg-background/60 text-muted" : ""}>
                  <td className="px-4 py-2 font-mono text-muted">{product?.code}</td>
                  <td className="px-4 py-2 font-medium text-navy">{name}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={allowZero ? 0 : 1}
                      step="1"
                      value={row.quantity}
                      onChange={(e) => lines.updateRow(row.key, { quantity: e.target.value })}
                      onKeyDown={backToSearch}
                      className={cellInput}
                      aria-label={`Quantity for ${name}`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unitPriceHT}
                      onChange={(e) => lines.updateRow(row.key, { unitPriceHT: e.target.value })}
                      onKeyDown={backToSearch}
                      className={cellInput}
                      aria-label={`Unit price for ${name}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatMoney(round2(lines.numeric[i].quantity * lines.numeric[i].unitPriceHT))}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => lines.removeRow(row.key)}
                      className="rounded px-2 py-1 text-muted hover:bg-red-50 hover:text-danger"
                      aria-label={`Remove ${name}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Subtotal → discount → total excl. VAT → VAT → total, for orders and purchases. */
export function OrderTotals({ totals }: { totals: { subtotalHT: number; discount: number; totalHT: number; vatAmount: number; totalTTC: number } }) {
  return (
    <dl className="space-y-2">
      <div className="flex justify-between">
        <dt className="text-muted">Subtotal excl. VAT</dt>
        <dd>{formatMoney(totals.subtotalHT)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">Discount</dt>
        <dd>{totals.discount > 0 ? `− ${formatMoney(totals.discount)}` : formatMoney(0)}</dd>
      </div>
      <div className="flex justify-between font-medium">
        <dt>Total excl. VAT</dt>
        <dd>{formatMoney(totals.totalHT)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">VAT 11%</dt>
        <dd>{formatMoney(totals.vatAmount)}</dd>
      </div>
      <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-navy">
        <dt>Total incl. VAT</dt>
        <dd>{formatMoney(totals.totalTTC)}</dd>
      </div>
    </dl>
  );
}
