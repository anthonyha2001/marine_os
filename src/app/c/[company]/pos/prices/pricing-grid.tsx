"use client";

import { useMemo, useState, useTransition } from "react";
import { savePosPrices } from "@/lib/actions/pos";
import type { PricingRow } from "@/lib/data/pos";
import { VAT_RATE, formatMoney, round2, withVat } from "@/lib/money";
import { htForShelfPrice } from "@/lib/pos";
import { useFeedback } from "@/components/feedback";
import { FormMessage, Kbd, StickyActions, cardClass, inputClass, primaryButton, secondaryButtonSm } from "@/components/ui";

type Filter = "all" | "shop" | "catalogue" | "below" | "loss" | "stock" | "nocost";
type Sort = "name" | "marginAsc" | "marginDesc" | "stock";
type Rounding = "none" | "00" | "50" | "99";

const num = (v: string) => Number(v.replace(/,/g, ""));
const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);

/** Round a shelf price (incl. VAT) up to a price ending the shop likes. */
function roundShelf(ttc: number, r: Rounding) {
  if (r === "00") return Math.ceil(ttc - 1e-9);
  if (r === "50") return Math.ceil(ttc * 2 - 1e-9) / 2;
  if (r === "99") return Math.ceil(ttc + 0.01 - 1e-9) - 0.01;
  return round2(ttc);
}

/**
 * Shop prices for the till. Type the shelf price incl. VAT; empty = sell at the catalogue price.
 * Margins are on the price excl. VAT against the average cost (management figures).
 */
export function PricingGrid({ companySlug, rows }: { companySlug: string; rows: PricingRow[] }) {
  const initial = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r.posPriceHT === null ? "" : withVat(r.posPriceHT).toFixed(2)])), [rows]);
  const [saved, setSaved] = useState<Record<string, string>>(initial);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [target, setTarget] = useState("35");
  const [rounding, setRounding] = useState<Rounding>("00");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();
  const targetPct = Math.min(Math.max(num(target) || 0, 0), 95);

  const figures = (r: PricingRow) => {
    const raw = values[r.id]?.trim() ?? "";
    const shelf = raw === "" ? null : num(raw);
    const invalid = shelf !== null && (!Number.isFinite(shelf) || shelf < 0);
    const priceHT = shelf === null || invalid ? r.priceHT : htForShelfPrice(shelf);
    const margin = round2(priceHT - r.cost);
    return {
      invalid,
      custom: shelf !== null && !invalid,
      priceHT,
      shelf: withVat(priceHT),
      margin,
      marginPct: r.cost > 0 && priceHT > 0 ? (margin / priceHT) * 100 : null,
      markupPct: r.cost > 0 ? (margin / r.cost) * 100 : null,
    };
  };

  const q = query.trim().toLowerCase();
  const visible = rows
    .map((r) => ({ r, f: figures(r) }))
    .filter(({ r, f }) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.code.startsWith(q)) return false;
      if (filter === "shop") return f.custom;
      if (filter === "catalogue") return !f.custom;
      if (filter === "below") return f.marginPct !== null && f.marginPct < targetPct;
      if (filter === "loss") return r.cost > 0 && f.margin < 0;
      if (filter === "stock") return r.stock > 0;
      if (filter === "nocost") return r.cost === 0;
      return true;
    })
    .sort((a, b) => {
      if (sort === "stock") return b.r.stock - a.r.stock;
      if (sort === "marginAsc" || sort === "marginDesc") {
        // Products without a cost have no margin: always last.
        const x = a.f.marginPct;
        const y = b.f.marginPct;
        if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
        return sort === "marginAsc" ? x - y : y - x;
      }
      return a.r.name.localeCompare(b.r.name);
    });

  const changed = rows.filter((r) => (values[r.id] ?? "").trim() !== (saved[r.id] ?? ""));
  const invalid = rows.some((r) => figures(r).invalid);
  const stockTotals = rows.reduce(
    (t, r) => {
      if (r.stock <= 0) return t;
      const f = figures(r);
      return { sales: t.sales + f.priceHT * r.stock, cost: t.cost + r.cost * r.stock };
    },
    { sales: 0, cost: 0 },
  );
  const stockMargin = stockTotals.sales > 0 ? ((stockTotals.sales - stockTotals.cost) / stockTotals.sales) * 100 : null;
  const allVisibleSelected = visible.length > 0 && visible.every(({ r }) => selected.has(r.id));

  const applyTarget = () => {
    let skipped = 0;
    const next = { ...values };
    for (const id of selected) {
      const r = rows.find((x) => x.id === id);
      if (!r) continue;
      if (r.cost <= 0) {
        skipped++;
        continue;
      }
      const ht = r.cost / (1 - targetPct / 100);
      next[id] = roundShelf(ht * (1 + VAT_RATE), rounding).toFixed(2);
    }
    setValues(next);
    const done = selected.size - skipped;
    if (done) toast.success(`${done} price${done === 1 ? "" : "s"} set for a ${targetPct}% margin. Check them, then save.`);
    if (skipped) toast.info(`${skipped} product${skipped === 1 ? " has" : "s have"} no cost yet, so ${skipped === 1 ? "it was" : "they were"} skipped.`);
  };

  const save = () => {
    if (!changed.length || invalid || pending) return;
    setError(undefined);
    const payload = changed.map((r) => {
      const raw = (values[r.id] ?? "").trim();
      return { id: r.id, shelfPrice: raw === "" ? null : num(raw) };
    });
    startTransition(async () => {
      const res = await savePosPrices(companySlug, JSON.stringify(payload));
      if (res.error) return setError(res.error);
      setSaved({ ...values });
      toast.success(`${payload.length} price${payload.length === 1 ? "" : "s"} saved. The till uses them now.`);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      data-save-shortcut
      data-dirty={changed.length ? "true" : undefined}
    >
      <div className={`${cardClass} flex flex-wrap items-end gap-3 p-4`}>
        <label className="min-w-48 flex-1 text-[13px] font-medium text-slate-700">
          Search
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or code" className={inputClass} />
        </label>
        <label className="text-[13px] font-medium text-slate-700">
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className={inputClass}>
            <option value="all">All products</option>
            <option value="stock">In stock</option>
            <option value="shop">With a shop price</option>
            <option value="catalogue">At the catalogue price</option>
            <option value="below">Below the target margin</option>
            <option value="loss">Selling at a loss</option>
            <option value="nocost">No cost yet</option>
          </select>
        </label>
        <label className="text-[13px] font-medium text-slate-700">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={inputClass}>
            <option value="name">Name</option>
            <option value="marginAsc">Lowest margin first</option>
            <option value="marginDesc">Highest margin first</option>
            <option value="stock">Most stock first</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-2 p-2">
          <label className="text-[13px] font-medium text-slate-700">
            Target margin %
            <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" className={`${inputClass} w-24 text-right tabular`} />
          </label>
          <label className="text-[13px] font-medium text-slate-700">
            Round to
            <select value={rounding} onChange={(e) => setRounding(e.target.value as Rounding)} className={inputClass}>
              <option value="00">Whole dollar</option>
              <option value="50">Next $0.50</option>
              <option value="99">Ending .99</option>
              <option value="none">Cents</option>
            </select>
          </label>
          <button type="button" disabled={!selected.size} onClick={applyTarget} className={`${secondaryButtonSm} h-10`}>
            Price {selected.size || ""} selected
          </button>
        </div>
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        <table className="w-full min-w-[64rem] text-sm">
          <thead className="bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) =>
                    setSelected((s) => {
                      const next = new Set(s);
                      for (const { r } of visible) {
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                      }
                      return next;
                    })
                  }
                  aria-label="Select all shown"
                  className="size-4 accent-brand"
                />
              </th>
              <th className="px-2 py-2.5">Product</th>
              <th className="px-2 py-2.5 text-right">Stock</th>
              <th className="px-2 py-2.5 text-right">Avg cost</th>
              <th className="px-2 py-2.5 text-right">Catalogue price</th>
              <th className="px-2 py-2.5 text-right">Shop price incl. VAT</th>
              <th className="px-2 py-2.5 text-right">Margin / unit</th>
              <th className="px-2 py-2.5 text-right">Margin</th>
              <th className="px-4 py-2.5 text-right">Markup</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted">
                  No products match.
                </td>
              </tr>
            )}
            {visible.map(({ r, f }) => {
              const tone = f.marginPct === null ? "text-muted" : f.margin < 0 ? "text-danger" : f.marginPct < targetPct ? "text-amber-700" : "text-success";
              const isChanged = (values[r.id] ?? "").trim() !== (saved[r.id] ?? "");
              return (
                <tr key={r.id} className={selected.has(r.id) ? "bg-brand/5" : undefined}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={(e) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(r.id);
                          else next.delete(r.id);
                          return next;
                        })
                      }
                      aria-label={`Select ${r.name}`}
                      className="size-4 accent-brand"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <span className="font-medium text-navy">{r.name}</span>
                    <span className="block font-mono text-xs text-muted">{r.code}</span>
                  </td>
                  <td className={`tabular px-2 py-2 text-right ${r.stock > 0 ? "" : "text-muted"}`}>{r.stock}</td>
                  <td className="tabular px-2 py-2 text-right">{r.cost > 0 ? formatMoney(r.cost) : <span className="text-xs text-muted">no cost yet</span>}</td>
                  <td className="tabular px-2 py-2 text-right text-muted">{formatMoney(withVat(r.priceHT))}</td>
                  <td className="px-2 py-2 text-right">
                    <input
                      value={values[r.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                      inputMode="decimal"
                      placeholder={withVat(r.priceHT).toFixed(2)}
                      aria-label={`Shop price for ${r.name}`}
                      className={`${inputClass} ml-auto h-9 w-28 text-right tabular ${f.invalid ? "border-danger" : isChanged ? "border-brand" : ""}`}
                    />
                  </td>
                  <td className={`tabular px-2 py-2 text-right ${tone}`}>{r.cost > 0 ? formatMoney(f.margin) : "—"}</td>
                  <td className={`tabular px-2 py-2 text-right font-semibold ${tone}`}>{pct(f.marginPct)}</td>
                  <td className="tabular px-4 py-2 text-right text-muted">{pct(f.markupPct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Margin = (price excl. VAT − average cost) ÷ price excl. VAT. Markup = the same profit ÷ cost. Leave a shop price empty to sell at the catalogue price.
      </p>
      <div className="mt-3">
        <FormMessage error={error ?? (invalid ? "One of the prices isn't a valid amount." : undefined)} />
      </div>
      <StickyActions
        summary={
          <span>
            Stock at shop prices {formatMoney(round2(stockTotals.sales))} excl. VAT · cost {formatMoney(round2(stockTotals.cost))} ·{" "}
            <span className="font-semibold text-navy">margin {pct(stockMargin)}</span>
            {changed.length > 0 && <span className="ml-2 text-brand">· {changed.length} unsaved</span>}
          </span>
        }
      >
        <button type="submit" disabled={!changed.length || invalid || pending} className={`${primaryButton} gap-2`}>
          {pending ? "Saving…" : "Save prices"}
          <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
      </StickyActions>
    </form>
  );
}
