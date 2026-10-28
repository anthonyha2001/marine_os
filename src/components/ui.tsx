import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// ── Shared look: inputs, buttons, cards, headers, badges, tables ──

export const inputClass =
  "mt-1.5 block h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-surface-2 [&:is(textarea)]:h-auto [&:is(textarea)]:py-2.5";

export const labelClass = "block text-[13px] font-medium text-slate-700";

const buttonBase =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:pointer-events-none disabled:opacity-50";

export const primaryButton = `${buttonBase} bg-navy text-white shadow-sm hover:bg-navy-deep`;
export const secondaryButton = `${buttonBase} border border-border bg-surface text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:bg-surface-2 hover:text-navy`;
export const secondaryButtonSm = `${buttonBase} h-8 rounded-md border border-border bg-surface px-3 text-xs text-slate-700 hover:bg-surface-2 hover:text-navy`;
export const dangerButton = `${buttonBase} border border-red-200 bg-surface text-danger hover:bg-red-50`;

export const cardClass = "rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/** Table cells: grey header row, roomy rows, figures aligned. */
export const thClass = "bg-surface-2 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted";
export const tdClass = "px-4 py-3 align-middle";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-wider text-brand">{eyebrow}</p>}
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-navy">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  icon: Icon,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  icon?: LucideIcon;
}) {
  return (
    <Link href={href} className={variant === "primary" ? primaryButton : secondaryButton}>
      {Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </Link>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
        {error}
      </p>
    );
  if (success) return <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">{success}</p>;
  return null;
}

// Status pills with a coloured dot.
const TONES = {
  green: "bg-green-50 text-green-700 ring-green-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/15",
} as const;
const DOTS = { green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500", blue: "bg-blue-500", gray: "bg-slate-400" } as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      <span className={`size-1.5 rounded-full ${DOTS[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

const STOCK = { out: ["red", "Out of stock"], low: ["amber", "Low"], ok: ["green", "In stock"] } as const;

export function StockBadge({ status }: { status: keyof typeof STOCK }) {
  const [tone, label] = STOCK[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function SavedNotice({ code, label = "Product" }: { code: string; label?: string }) {
  return (
    <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
      {label} #{code} saved.
    </p>
  );
}

/** Keyboard key hint, e.g. <Kbd>F2</Kbd>. */
export function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={`rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted ${className}`}>
      {children}
    </kbd>
  );
}

/** KPI tile: label, big figure, optional hint and icon. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "danger" | "success";
  href?: string;
}) {
  const valueColor = { default: "text-navy", danger: "text-danger", success: "text-success" }[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon && (
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className={`tabular mt-2 text-2xl font-semibold tracking-tight ${valueColor}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = `${cardClass} block p-4`;
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-brand/40 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Friendly placeholder for empty lists. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-4 font-semibold text-navy">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Search box for list pages: submits ?q= on Enter (keeps other filters via `keep`).
 * "/" focuses it (data-shortcut-search).
 */
export function SearchBar({
  action,
  defaultValue,
  placeholder,
  keep = {},
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  keep?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} className="relative w-full max-w-md" role="search">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <svg className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        name="q"
        type="search"
        data-shortcut-search
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="block h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-10 text-sm shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-surface-2 px-1.5 font-mono text-[10px] text-muted">/</kbd>
    </form>
  );
}

/**
 * Bar stuck to the bottom of the screen on long forms: a summary (e.g. the total) on the
 * left, the main actions on the right, always visible while scrolling.
 */
export function StickyActions({ summary, children }: { summary?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.05)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm text-muted">{summary}</div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

/** Paid / invoiced progress: a thin bar plus the percentage. Green when complete. */
export function ProgressBar({ value, label, className = "" }: { value: number; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const done = pct >= 0.9999;
  return (
    <div className={`flex items-center gap-2 ${className}`} title={label ?? `${Math.round(pct * 100)}%`}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
        aria-label={label}
      >
        <div className={`h-full rounded-full ${done ? "bg-success" : "bg-brand"}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className={`tabular w-9 text-right text-xs ${done ? "font-medium text-success" : "text-muted"}`}>{Math.round(pct * 100)}%</span>
    </div>
  );
}
