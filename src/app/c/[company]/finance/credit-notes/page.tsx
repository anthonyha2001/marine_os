import { Suspense } from "react";
import Link from "next/link";
import { FileMinus, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { businessToday, dayFormat } from "@/lib/dates";
import { listCreditNotes } from "@/lib/data/ledger";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Badge, ButtonLink, EmptyState, PageHeader, SearchBar, StatCard, cardClass, tdClass, thClass } from "@/components/ui";

async function CreditNotesContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ company }, { q = "" }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "invoices");
  const base = `/c/${slug}/finance/credit-notes`;
  const notes = await listCreditNotes(slug);
  const needle = q.trim().toLowerCase();
  const shown = notes.filter(
    (c) => !needle || [c.number, c.customerName, c.reason, c.invoice?.number ?? ""].some((t) => t.toLowerCase().includes(needle)),
  );
  const issued = notes.filter((c) => c.status === "ISSUED");
  const year = businessToday().slice(0, 4);

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Finance`}
        title="Credit notes"
        description="Credits issued to customers against invoices. Each one reverses the sale and VAT and lowers the invoice balance."
        action={<ButtonLink icon={Plus} href={`${base}/new`}>New credit note</ButtonLink>}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label={`Credited in ${year}`}
          value={formatMoney(round2(issued.filter((c) => c.date.toISOString().startsWith(year)).reduce((s, c) => s + c.totalTTC, 0)))}
          icon={FileMinus}
        />
        <StatCard label="Credit notes issued" value={String(issued.length)} hint="excluding cancelled" />
      </div>
      <div className="mt-6">
        <SearchBar action={base} defaultValue={q} placeholder="Search by number, customer, invoice or reason" />
      </div>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {shown.length === 0 ? (
          <EmptyState icon={FileMinus} title={q ? "No credit notes match this search" : "No credit notes yet"} description="Issue one from an invoice, or with New credit note." />
        ) : (
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Credit note</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Customer</th>
                <th className={thClass}>Invoice</th>
                <th className={thClass}>Reason</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((c) => (
                <tr key={c.id} className={`hover:bg-surface-2/60 ${c.status === "CANCELLED" ? "opacity-60" : ""}`}>
                  <td className={tdClass}>
                    <Link href={`${base}/${c.id}`} className="font-mono text-xs font-medium text-brand hover:underline">
                      {c.number}
                    </Link>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>{dayFormat.format(c.date)}</td>
                  <td className={`${tdClass} font-medium text-navy`}>{c.customerName}</td>
                  <td className={tdClass}>
                    {c.invoice ? (
                      <Link href={`/c/${slug}/invoices/${c.invoice.id}`} className="font-mono text-xs text-muted hover:underline">
                        {c.invoice.number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${tdClass} max-w-xs truncate text-muted`}>{c.reason}</td>
                  <td className={tdClass}>
                    <Badge tone={c.status === "ISSUED" ? "blue" : "gray"}>{c.status === "ISSUED" ? "Issued" : "Cancelled"}</Badge>
                  </td>
                  <td className={`${tdClass} tabular text-right font-semibold`}>{formatMoney(c.totalTTC)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function CreditNotesPage({ params, searchParams }: PageProps<"/c/[company]/finance/credit-notes">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading credit notes…</p>}>
      <CreditNotesContent params={params} searchParams={searchParams as Promise<{ q?: string }>} />
    </Suspense>
  );
}
