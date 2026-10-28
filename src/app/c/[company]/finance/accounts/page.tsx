import { Suspense } from "react";
import Link from "next/link";
import { Lock, Pencil, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { deleteLedgerAccount } from "@/lib/actions/finance";
import { getLedger } from "@/lib/data/ledger";
import { accountTotals } from "@/lib/ledger/reports";
import { COMPANIES } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { Modal } from "@/components/modal";
import { Badge, ButtonLink, PageHeader, cardClass, tdClass, thClass } from "@/components/ui";
import { Amount } from "../finance-ui";
import { AccountForm } from "./account-form";

type Search = { new?: string; edit?: string; saved?: string; inactive?: string };

const GROUPS = [
  { type: "ASSET", label: "Assets" },
  { type: "LIABILITY", label: "Liabilities" },
  { type: "EQUITY", label: "Equity" },
  { type: "INCOME", label: "Income" },
  { type: "EXPENSE", label: "Expenses" },
] as const;

const KIND_LABELS: Record<string, string> = {
  CASH: "Cash box",
  BANK: "Bank",
  RECEIVABLE: "Customers",
  PAYABLE: "Suppliers",
  VAT_IN: "VAT recoverable",
  VAT_OUT: "VAT collected",
  SALES: "Sales",
  PURCHASES: "Purchases",
  CAPITAL: "Capital",
};

async function AccountsContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "accounting");
  const base = `/c/${slug}/finance/accounts`;
  const ledger = await getLedger(slug);
  const totals = accountTotals(ledger).filter((a) => a.active || search.inactive);
  const editing = search.edit ? ledger.accounts.find((a) => a.id === search.edit) : undefined;
  const inactiveCount = ledger.accounts.filter((a) => !a.active).length;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Finance`}
        title="Chart of accounts"
        description="The accounts every entry is posted to, with their current balance. Add expense accounts, cash boxes and bank accounts as you need them."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New account</ButtonLink>}
      />
      {search.saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Account saved.
        </p>
      )}
      {inactiveCount > 0 && (
        <p className="mt-4 text-sm text-muted">
          {search.inactive ? (
            <Link href={base} className="text-brand hover:underline">
              Hide {inactiveCount} inactive
            </Link>
          ) : (
            <Link href={`${base}?inactive=1`} className="text-brand hover:underline">
              Show {inactiveCount} inactive
            </Link>
          )}
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {GROUPS.map((g) => {
          const rows = totals.filter((a) => a.type === g.type);
          if (!rows.length) return null;
          return (
            <section key={g.type} className={`${cardClass} overflow-x-auto`}>
              <h2 className="border-b border-border px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted">{g.label}</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={`${thClass} w-20`}>Code</th>
                    <th className={thClass}>Account</th>
                    <th className={`${thClass} text-right`}>Balance</th>
                    <th className={`${thClass} w-24`} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((a) => (
                    <tr key={a.id} className={`hover:bg-surface-2/60 ${a.active ? "" : "opacity-50"}`}>
                      <td className={`${tdClass} font-mono text-xs text-muted`}>{a.code}</td>
                      <td className={tdClass}>
                        <Link href={`/c/${slug}/finance/reports?r=gl&account=${a.id}`} className="font-medium text-navy hover:text-brand hover:underline">
                          {a.name}
                        </Link>
                        <span className="ml-2 inline-flex items-center gap-1 align-middle">
                          {KIND_LABELS[a.kind] && <Badge tone={a.kind === "CASH" || a.kind === "BANK" ? "green" : "gray"}>{KIND_LABELS[a.kind]}</Badge>}
                          {a.isSystem && <Lock className="size-3 text-slate-400" aria-label="Used by automatic postings" />}
                          {!a.active && <Badge tone="gray">Inactive</Badge>}
                        </span>
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Amount value={a.balance} blankZero />
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right`}>
                        <Link
                          href={`${base}?edit=${a.id}`}
                          scroll={false}
                          title="Edit account"
                          aria-label="Edit account"
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Link>
                        {!a.isSystem && a.active && (
                          <DeleteButton
                            action={deleteLedgerAccount.bind(null, slug, a.id)}
                            confirmText={`Delete account ${a.code} ${a.name}? If it already has entries it is deactivated instead, so history is kept.`}
                            title="Delete account"
                            successMessage="Account removed."
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>

      {(search.new || editing) && (
        <Modal title={editing ? `Edit ${editing.code} ${editing.name}` : "New account"} closeHref={base} size="md">
          <AccountForm key={crypto.randomUUID()} companySlug={slug} account={editing} />
        </Modal>
      )}
    </>
  );
}

export default function AccountsPage({ params, searchParams }: PageProps<"/c/[company]/finance/accounts">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading accounts…</p>}>
      <AccountsContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
