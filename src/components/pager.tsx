import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { withParams } from "@/lib/url";
import { secondaryButtonSm } from "@/components/ui";

/** The page number in ?page= (1 when missing or invalid). */
export function pageFrom(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

/**
 * "51–100 of 230" with previous / next links for a server-paginated list. `href` is the current
 * address (with its filters); only ?page= changes.
 */
export function Pager({ href, page, pageSize, total }: { href: string; page: number; pageSize: number; total: number }) {
  if (total <= pageSize && page === 1) return null;
  const first = Math.min(total, (page - 1) * pageSize + 1);
  const last = Math.min(total, page * pageSize);
  const to = (p: number) => withParams(href, { page: p > 1 ? String(p) : null });
  const disabled = "pointer-events-none opacity-40";
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
      <p className="tabular">
        {first}–{last} of {total}
      </p>
      <div className="flex gap-2">
        <Link href={to(page - 1)} scroll={false} aria-disabled={page <= 1} className={`${secondaryButtonSm} gap-1 ${page <= 1 ? disabled : ""}`}>
          <ChevronLeft className="size-3.5" aria-hidden /> Previous
        </Link>
        <Link href={to(page + 1)} scroll={false} aria-disabled={last >= total} className={`${secondaryButtonSm} gap-1 ${last >= total ? disabled : ""}`}>
          Next <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
