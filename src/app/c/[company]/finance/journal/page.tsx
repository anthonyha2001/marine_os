import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { deleteJournalEntry } from "@/lib/actions/finance";
import { dayFormat } from "@/lib/dates";
import { getLedger } from "@/lib/data/ledger";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES, can, isAdmin } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { Modal } from "@/components/modal";
import { Badge, ButtonLink, EmptyState, PageHeader, SearchBar, cardClass } from "@/components/ui";
import { Amount, PeriodFilter, SOURCE_LABELS, periodFrom, sourceHref, type PeriodParams } from "../finance-ui";
import { JournalForm } from "./journal-form";
import { CancelButton } from "@/components/cancel-button";
import { reverseJournalEntry } from "@/lib/actions/cancel";

type Search = PeriodParams & { q?: string; new?: string; saved?: string; source?: string };

async function JournalContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "accounting");
  const base = `/c/${slug}/finance/journal`;
  const ledger = await getLedger(slug);
  const admin = isAdmin(user);
  const mayReverse = can(user, "cancelEntries");
  const reversed = new Set(ledger.entries.map((e) => e.reversalOf).filter(Boolean));
  const { fromStr, toStr, period } = periodFrom(search);
  const accounts = new Map(ledger.accounts.map((a) => [a.id, a]));
  const needle = (search.q ?? "").trim().toLowerCase();
  const entries = ledger.entries
    .filter((e) => (!period.from || e.date >= period.from) && (!period.to || e.date <= period.to))
    .filter((e) => !search.source || e.sourceType === search.source)
    .filter(
      (e) =>
        !needle ||
        e.number.toLowerCase().includes(needle) ||
        e.memo.toLowerCase().includes(needle) ||
        e.lines.some((l) => (accounts.get(l.accountId)?.code ?? "").startsWith(needle) || (l.description ?? "").toLowerCase().includes(needle)),
    )
    .slice()
    .reverse();
  const shown = entries.slice(0, 200);

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Finance`}
        title="Journal"
        description="Every accounting entry, in double entry. Documents post automatically; use a manual entry for opening balances, accruals or corrections."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>Manual entry</ButtonLink>}
      />
      {search.saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Journal entry posted.
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <SearchBar action={base} defaultValue={search.q} placeholder="Search by entry, description or account code" keep={{ from: fromStr, to: toStr, source: search.source }} />
        <PeriodFilter action={base} from={fromStr} to={toStr} keep={{ q: search.q }}>
          <label className="text-xs font-medium text-muted">
            Type
            <select name="source" defaultValue={search.source ?? ""} className="mt-1 block h-9 w-44 rounded-lg border border-border bg-surface px-2 text-sm">
              <option value="">All entries</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </PeriodFilter>
      </div>

      <div className="mt-4 space-y-3">
        {shown.length === 0 ? (
          <div className={cardClass}>
            <EmptyState icon={BookOpen} title="No entries in this period" />
          </div>
        ) : (
          shown.map((e) => {
            const href = sourceHref(slug, e.sourceType, e.sourceId);
            const total = round2(e.lines.reduce((s, l) => s + l.debit, 0));
            return (
              <article key={e.id} className={`${cardClass} overflow-hidden`}>
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-mono text-xs font-semibold text-navy">{e.number}</span>
                    <span className="text-muted">{dayFormat.format(e.date)}</span>
                    <Badge tone={e.sourceType === "MANUAL" ? "amber" : e.sourceType === "REVERSAL" ? "red" : "gray"}>{SOURCE_LABELS[e.sourceType] ?? e.sourceType}</Badge>
                    {href ? (
                      <Link href={href} className="font-medium text-navy hover:text-brand hover:underline">
                        {e.memo}
                      </Link>
                    ) : (
                      <span className="font-medium text-navy">{e.memo}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>
                      {formatMoney(total)} · by {e.createdByName}
                    </span>
                    {e.sourceType === "MANUAL" && reversed.has(e.id) && <Badge tone="red">Reversed</Badge>}
                    {e.sourceType === "MANUAL" && !reversed.has(e.id) && mayReverse && (
                      <CancelButton
                        reverse
                        action={reverseJournalEntry.bind(null, slug, e.id)}
                        title="Reverse entry"
                        message={`A new entry dated today swaps the debits and credits of ${e.number}. Both stay in the journal.`}
                      />
                    )}
                    {e.sourceType === "MANUAL" && admin && (
                      <DeleteButton
                        action={deleteJournalEntry.bind(null, slug, e.id)}
                        confirmText={`Delete manual entry ${e.number}? It goes to the recycle bin and can be restored.`}
                        title="Delete entry"
                        successMessage="Entry moved to the recycle bin."
                      />
                    )}
                  </div>
                </header>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border/70">
                    {e.lines.map((l, i) => {
                      const a = accounts.get(l.accountId);
                      return (
                        <tr key={i}>
                          <td className={`w-1/2 px-4 py-1.5 ${l.credit > 0 ? "pl-10" : ""}`}>
                            <span className="font-mono text-xs text-muted">{a?.code}</span> <span className="text-navy">{a?.name}</span>
                            {l.description && <span className="block text-xs text-muted">{l.description}</span>}
                          </td>
                          <td className="w-1/4 px-4 py-1.5 text-right">
                            <Amount value={l.debit} blankZero />
                          </td>
                          <td className="w-1/4 px-4 py-1.5 text-right">
                            <Amount value={l.credit} blankZero />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>
            );
          })
        )}
        {entries.length > shown.length && <p className="text-center text-sm text-muted">Showing the latest 200 of {entries.length} entries. Narrow the period to see more.</p>}
      </div>

      {search.new && (
        <Modal title="Manual journal entry" closeHref={base} size="xl">
          <JournalForm
            key={crypto.randomUUID()}
            companySlug={slug}
            accounts={ledger.accounts.filter((a) => a.active).map((a) => ({ id: a.id, code: a.code, name: a.name }))}
          />
        </Modal>
      )}
    </>
  );
}

export default function JournalPage({ params, searchParams }: PageProps<"/c/[company]/finance/journal">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading journal…</p>}>
      <JournalContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
