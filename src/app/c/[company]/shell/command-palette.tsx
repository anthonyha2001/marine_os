"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { globalSearch, type SearchResult } from "@/lib/actions/search";
import type { NavGroup } from "@/lib/navigation";

/**
 * Ctrl+K search: jump to any screen, or find a product, service, customer, supplier, offer,
 * invoice or purchase order. Opened by Ctrl+K or the "marine:search" event (top bar button).
 */
export function CommandPalette({ companySlug, base, groups }: { companySlug: string; base: string; groups: NavGroup[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("marine:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("marine:search", onOpen);
    };
  }, []);

  // Mounted only while open, so every opening starts with an empty search.
  return open ? <PaletteDialog companySlug={companySlug} base={base} groups={groups} onClose={() => setOpen(false)} /> : null;
}

function PaletteDialog({
  companySlug,
  base,
  groups,
  onClose,
}: {
  companySlug: string;
  base: string;
  groups: NavGroup[];
  onClose: () => void;
}) {
  const router = useRouter();
  const setOpen = (value: boolean) => !value && onClose();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const screens: SearchResult[] = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.map((i) => ({ group: "Go to", label: i.label, detail: i.shortcut, href: `${base}/${i.path}` })),
      ),
    [groups, base],
  );

  const q = query.trim().toLowerCase();
  const screenMatches = (q ? screens.filter((s) => s.label.toLowerCase().includes(q)) : screens).slice(0, q ? 5 : 8);
  const all = [...screenMatches, ...results];

  function onChange(value: string) {
    setQuery(value);
    setHighlight(0);
    const id = ++requestId.current;
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      try {
        const found = await globalSearch(companySlug, value);
        if (id === requestId.current) setResults(found);
      } catch {
        if (id === requestId.current) setResults([]);
      }
    });
  }

  function go(item: SearchResult | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-navy-deep/40 p-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-5 text-muted" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, all.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(all[highlight]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Search products, customers, offers, invoices… or type a page"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
          />
          {pending && <span className="text-xs text-muted">Searching…</span>}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-2">
          {all.length === 0 && q.length >= 2 && !pending && <li className="px-4 py-8 text-center text-sm text-muted">No results for “{query}”.</li>}
          {all.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={`${item.href}-${i}`}>
                {header && <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{header}</p>}
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => go(item)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${i === highlight ? "bg-brand-soft text-navy" : "text-slate-700"}`}
                >
                  <span className="truncate font-medium">{item.label}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {item.detail}
                    {i === highlight && <CornerDownLeft className="size-3.5" aria-hidden />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-border bg-surface-2 px-4 py-2 text-[11px] text-muted">
          <span>↑ ↓ to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
