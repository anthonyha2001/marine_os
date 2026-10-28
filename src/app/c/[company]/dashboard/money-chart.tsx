"use client";

import { useState } from "react";

export type MonthPoint = { label: string; invoiced: number; purchases: number };

// Categorical slots 1–2 of the reference palette, validated on the white card surface
// (CVD ΔE 24.7, normal-vision ΔE 33.6, both ≥ 3:1 contrast).
const SERIES = [
  { key: "invoiced", label: "Invoiced", color: "#2a78d6" },
  { key: "purchases", label: "Purchases", color: "#eb6834" },
] as const;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Grouped columns: money invoiced vs purchases per month, with hover details and a table view. */
export function MoneyChart({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  // Nothing to draw yet: say so instead of plotting an empty, meaningless scale.
  if (data.every((d) => d.invoiced === 0 && d.purchases === 0)) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
        <p className="text-sm font-medium text-navy">No invoices or purchases in the last 6 months</p>
        <p className="mt-1 text-xs text-muted">The chart fills in as you invoice customers and record purchases.</p>
      </div>
    );
  }

  const W = 640;
  const H = 240;
  const pad = { top: 16, right: 8, bottom: 28, left: 48 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.flatMap((d) => [d.invoiced, d.purchases]));
  // A "nice" top for the axis: 1, 2 or 5 × a power of ten.
  const step = 10 ** Math.floor(Math.log10(max));
  const top = [1, 2, 5, 10].map((m) => m * step).find((t) => t >= max) ?? max;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const band = plotW / data.length;
  const barW = Math.min(24, (band - 16) / 2); // ≤ 24px thick, the rest of the band is air
  const y = (v: number) => pad.top + plotH - (v / top) * plotH;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex gap-4 text-xs text-muted" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setAsTable((t) => !t)} className="text-xs font-medium text-brand hover:underline">
          {asTable ? "View as chart" : "View as table"}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="py-1.5">Month</th>
              <th className="py-1.5 text-right">Invoiced</th>
              <th className="py-1.5 text-right">Purchases</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((d) => (
              <tr key={d.label}>
                <td className="py-1.5">{d.label}</td>
                <td className="py-1.5 text-right">{money.format(d.invoiced)}</td>
                <td className="py-1.5 text-right">{money.format(d.purchases)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Invoiced and purchases per month">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#e8edf3" strokeWidth={1} />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#64748b">
                  {t === 0 ? "0" : `$${compact.format(t)}`}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = pad.left + band * i + band / 2;
              return (
                <g key={d.label}>
                  {hover === i && <rect x={pad.left + band * i + 2} y={pad.top} width={band - 4} height={plotH} rx={6} fill="#f1f5f9" />}
                  {SERIES.map((s, si) => {
                    const v = d[s.key];
                    const h = (v / top) * plotH;
                    const x = cx + (si === 0 ? -barW - 1 : 1); // 2px surface gap between the pair
                    const r = Math.min(4, h); // 4px rounded data-end, square at the baseline
                    return h > 0 ? (
                      <path
                        key={s.key}
                        d={`M${x},${pad.top + plotH} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                        fill={s.color}
                      />
                    ) : null;
                  })}
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="#64748b">
                    {d.label}
                  </text>
                  {/* Hit target: the whole month band, larger than the bars. */}
                  <rect
                    x={pad.left + band * i}
                    y={pad.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            })}
            <line x1={pad.left} x2={W - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#cbd5e1" strokeWidth={1} />
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg"
              style={{ left: `${((pad.left + band * hover + band / 2) / W) * 100}%`, transform: "translateX(-50%)" }}
            >
              <p className="mb-1 font-semibold text-navy">{data[hover].label}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                    {s.label}
                  </span>
                  <span className="tabular font-medium text-navy">{money.format(data[hover][s.key])}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
