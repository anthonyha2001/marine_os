"use client";

import { Plus, Trash2 } from "lucide-react";
import { formatMoney, round2 } from "@/lib/money";
import { inputClass, secondaryButtonSm } from "@/components/ui";

export type CatalogueItem = { id: string; code: string; name: string; type: "PRODUCT" | "SERVICE"; priceHT: number };
export type LineKind = "PART" | "LABOR" | "SERVICE";
export type FreeLine = {
  key: string;
  productId: string | null;
  kind: LineKind;
  title: string;
  quantity: string;
  unitPrice: string;
  billable: boolean;
  locked?: boolean; // already invoiced
};

export const KIND_LABELS: Record<LineKind, string> = { PART: "Part", LABOR: "Labour", SERVICE: "Service" };
export const newLine = (kind: LineKind = "PART"): FreeLine => ({ key: crypto.randomUUID(), productId: null, kind, title: "", quantity: "1", unitPrice: "", billable: true });
export const lineAmount = (l: FreeLine) => round2((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0));

/**
 * Editable lines: type a description, or pick a catalogue product / service (code or name)
 * to fill it in with its price. `withKind` shows Part / Labour / Service; `withBillable`
 * shows the "bill" tick (job cards made from an offer).
 */
export function FreeLinesEditor({
  lines,
  onChange,
  catalogue,
  withKind = false,
  withBillable = false,
  listId,
}: {
  lines: FreeLine[];
  onChange: (lines: FreeLine[]) => void;
  catalogue: CatalogueItem[];
  withKind?: boolean;
  withBillable?: boolean;
  listId: string;
}) {
  const set = (key: string, patch: Partial<FreeLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const pick = (key: string, value: string) => {
    const item = catalogue.find((c) => `${c.code} · ${c.name}` === value);
    if (item) set(key, { title: item.name, productId: item.id, unitPrice: String(item.priceHT), kind: item.type === "SERVICE" ? "SERVICE" : "PART" });
    else set(key, { title: value, productId: null });
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              {withKind && <th className="w-28 py-2 pr-2">Type</th>}
              <th className="py-2 pr-2">Description</th>
              <th className="w-24 py-2 pr-2 text-right">Qty</th>
              <th className="w-32 py-2 pr-2 text-right">Unit price excl. VAT</th>
              <th className="w-28 py-2 pr-2 text-right">Amount</th>
              {withBillable && <th className="w-16 py-2 pr-2 text-center">Bill</th>}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.key} className={l.locked ? "opacity-60" : ""}>
                {withKind && (
                  <td className="py-1 pr-2">
                    <select disabled={l.locked} value={l.kind} onChange={(e) => set(l.key, { kind: e.target.value as LineKind })} aria-label={`Line ${i + 1} type`} className={`${inputClass} h-9`}>
                      {Object.entries(KIND_LABELS).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="py-1 pr-2">
                  <input
                    disabled={l.locked}
                    value={l.title}
                    list={listId}
                    onChange={(e) => pick(l.key, e.target.value)}
                    placeholder="Type, or pick a product / service"
                    aria-label={`Line ${i + 1} description`}
                    className={`${inputClass} h-9`}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input disabled={l.locked} type="number" min="0" step="any" value={l.quantity} onChange={(e) => set(l.key, { quantity: e.target.value })} aria-label={`Line ${i + 1} quantity`} className={`${inputClass} h-9 text-right`} />
                </td>
                <td className="py-1 pr-2">
                  <input disabled={l.locked} type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => set(l.key, { unitPrice: e.target.value })} aria-label={`Line ${i + 1} unit price`} className={`${inputClass} h-9 text-right`} />
                </td>
                <td className="tabular py-1 pr-2 text-right font-medium">{formatMoney(lineAmount(l))}</td>
                {withBillable && (
                  <td className="py-1 pr-2 text-center">
                    <input disabled={l.locked} type="checkbox" checked={l.billable} onChange={(e) => set(l.key, { billable: e.target.checked })} aria-label={`Bill line ${i + 1}`} className="size-4 accent-brand" />
                  </td>
                )}
                <td className="py-1 text-right">
                  {!l.locked && (
                    <button type="button" onClick={() => onChange(lines.filter((x) => x.key !== l.key))} title="Remove line" aria-label={`Remove line ${i + 1}`} className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-danger">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id={listId}>
          {catalogue.map((c) => (
            <option key={c.id} value={`${c.code} · ${c.name}`} />
          ))}
        </datalist>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange([...lines, newLine("PART")])} className={secondaryButtonSm}>
          <Plus className="size-3.5" aria-hidden /> Add line
        </button>
        {withKind && (
          <button type="button" onClick={() => onChange([...lines, { ...newLine("LABOR"), title: "Labour", unitPrice: "" }])} className={secondaryButtonSm}>
            <Plus className="size-3.5" aria-hidden /> Add labour
          </button>
        )}
      </div>
    </div>
  );
}
