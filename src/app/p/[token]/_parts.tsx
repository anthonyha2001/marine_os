import Link from "next/link";
import { Check } from "lucide-react";
import { JOB_STAGES } from "@/lib/data/portal";
import { COMPANIES, type CompanySlug } from "@/lib/permissions";
import { cardClass } from "@/components/ui";

// Building blocks shared by the customer portal pages.

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, icon: Icon, action, children, className = "" }: { title?: string; icon?: React.ComponentType<{ className?: string }>; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${cardClass} overflow-hidden ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
            {Icon && <Icon className="size-4 text-brand" />} {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

export function CompanyTag({ slug }: { slug: CompanySlug }) {
  return <span className="text-xs text-muted">{COMPANIES[slug].name}</span>;
}

/** Received → In progress → Ready → Invoiced, with the current step lit. */
export function JobTrack({ stage }: { stage: number }) {
  return (
    <ol className="flex items-center" aria-label={`Status: ${JOB_STAGES[stage]}`}>
      {JOB_STAGES.map((label, i) => (
        <li key={label} className="flex flex-1 items-center last:flex-none">
          <span className="flex flex-col items-center gap-1">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                i < stage ? "bg-success text-white" : i === stage ? "bg-brand text-white ring-4 ring-brand/15" : "bg-surface-2 text-muted"
              }`}
            >
              {i < stage ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={`whitespace-nowrap text-[11px] ${i === stage ? "font-semibold text-navy" : "text-muted"}`}>{label}</span>
          </span>
          {i < JOB_STAGES.length - 1 && <span className={`mx-1 mb-5 h-0.5 flex-1 rounded ${i < stage ? "bg-success" : "bg-border"}`} />}
        </li>
      ))}
    </ol>
  );
}

export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface-2">
      {children}
    </Link>
  );
}
