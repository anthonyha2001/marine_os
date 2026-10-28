import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { listCreditNotes } from "@/lib/data/ledger";
import { formatMoney, VAT_RATE } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Badge, PageHeader, cardClass, primaryButton, secondaryButton } from "@/components/ui";
import { CancelCreditNoteButton } from "./cancel-button";

async function CreditNoteDetail({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; creditNoteId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ company, creditNoteId }, { saved }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "invoices");
  const note = (await listCreditNotes(slug)).find((c) => c.id === creditNoteId);
  if (!note) notFound();
  const pdfUrl = `/c/${slug}/finance/credit-notes/${note.id}/pdf`;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Credit note`}
        title={note.number}
        description={note.reason}
        action={
          <>
            <a href={pdfUrl} target="_blank" rel="noopener" className={`${primaryButton} gap-2`}>
              Open PDF
            </a>
            <a href={`${pdfUrl}?download=1`} className={secondaryButton}>
              Download PDF
            </a>
            {note.status === "ISSUED" && <CancelCreditNoteButton companySlug={slug} creditNoteId={note.id} number={note.number} />}
          </>
        }
      />
      {saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Credit note issued and posted to the accounts.
        </p>
      )}
      <div className="mt-3">
        <Badge tone={note.status === "ISSUED" ? "blue" : "gray"}>{note.status === "ISSUED" ? "Issued" : "Cancelled"}</Badge>
      </div>

      <dl className={`${cardClass} mt-6 grid gap-4 p-5 sm:grid-cols-3`}>
        {(
          [
            ["Customer", note.customerName],
            ["Date", dayFormat.format(note.date)],
            [
              "Invoice",
              note.invoice ? (
                <Link href={`/c/${slug}/invoices/${note.invoice.id}`} className="font-mono text-brand hover:underline">
                  {note.invoice.number}
                </Link>
              ) : (
                "—"
              ),
            ],
          ] as [string, React.ReactNode][]
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-navy">{value}</dd>
          </div>
        ))}
      </dl>

      <div className={`${cardClass} mt-6 overflow-x-auto`}>
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit price excl. VAT</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {note.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 font-medium text-navy">{l.title}</td>
                <td className="px-4 py-3 text-right">{l.quantity}</td>
                <td className="px-4 py-3 text-right">{formatMoney(l.unitPrice)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex justify-end">
        <dl className={`${cardClass} w-full max-w-sm space-y-2 p-5 text-sm`}>
          <div className="flex justify-between"><dt>Total excl. VAT</dt><dd className="font-medium">{formatMoney(note.totalHT)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{note.applyVat ? `VAT ${VAT_RATE * 100}%` : "VAT"}</dt><dd>{note.applyVat ? formatMoney(note.vatAmount) : "Exempt"}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-navy"><dt>Total credited</dt><dd>{formatMoney(note.totalTTC)}</dd></div>
        </dl>
      </div>
    </>
  );
}

export default function CreditNotePage({ params, searchParams }: PageProps<"/c/[company]/finance/credit-notes/[creditNoteId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CreditNoteDetail params={params} searchParams={searchParams as Promise<{ saved?: string }>} />
    </Suspense>
  );
}
