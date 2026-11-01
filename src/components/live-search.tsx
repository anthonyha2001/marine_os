"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";

/**
 * Search box for list pages that filters while you type (?q= updated after a short pause).
 * Enter still searches straight away. Other filters in the address are kept; `keep` adds more.
 */
export function LiveSearch({ action, defaultValue, placeholder, keep = {} }: { action: string; defaultValue?: string; placeholder: string; keep?: Record<string, string | undefined> }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const go = (value: string) => {
    const params = new URLSearchParams(pathname === action ? current.toString() : "");
    for (const [k, v] of Object.entries(keep)) if (v) params.set(k, v);
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    // A new search starts from the first page and closes any open pop-up.
    for (const k of ["page", "view", "done"]) params.delete(k);
    const qs = params.toString();
    start(() => router.replace(qs ? `${action}?${qs}` : action, { scroll: false }));
  };

  return (
    <form
      action={action}
      className="relative w-full max-w-md"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(String(new FormData(e.currentTarget).get("q") ?? ""));
      }}
    >
      {pending ? (
        <LoaderCircle className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-brand" aria-hidden />
      ) : (
        <svg className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      )}
      <input
        name="q"
        type="search"
        data-shortcut-search
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        onChange={(e) => {
          const value = e.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => go(value), 250);
        }}
        className="block h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-10 text-sm shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-surface-2 px-1.5 font-mono text-[10px] text-muted">/</kbd>
    </form>
  );
}
