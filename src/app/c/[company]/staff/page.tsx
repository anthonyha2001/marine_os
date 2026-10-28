import { Suspense } from "react";
import Link from "next/link";
import { IdCard, Pencil, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { listEmployees, outstandingAdvances } from "@/lib/data/payroll";
import { formatMoney, round2 } from "@/lib/money";
import { PAY_FREQUENCIES, monthlyEquivalent } from "@/lib/payroll";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { Badge, ButtonLink, EmptyState, PageHeader, SearchBar, StatCard, cardClass, tdClass, thClass } from "@/components/ui";
import { ActiveToggle } from "./active-toggle";
import { EmployeeForm } from "./employee-form";

type Search = { q?: string; new?: string; edit?: string; saved?: string; left?: string };

async function StaffContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "payroll");
  const base = `/c/${slug}/staff`;
  const [all, advances] = await Promise.all([listEmployees(slug), outstandingAdvances(slug)]);
  const active = all.filter((e) => e.active);
  const needle = (search.q ?? "").trim().toLowerCase();
  const shown = all.filter((e) => (search.left ? !e.active : e.active) && (!needle || e.name.toLowerCase().includes(needle) || (e.position ?? "").toLowerCase().includes(needle)));
  const monthly = round2(active.reduce((s, e) => s + monthlyEquivalent(e.payFrequency, e.baseSalary), 0));
  const editing = search.edit ? all.find((e) => e.id === search.edit) : undefined;
  const advanceOf = (e: (typeof all)[number]) => round2((advances.byName.get(e.name.trim().toLowerCase()) ?? 0) - (advances.repaid.get(e.id) ?? 0));

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Staff"
        description="Everyone on the payroll, how often they are paid and their base salary. Staff don't need a login."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New employee</ButtonLink>}
      />
      {search.saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Employee saved.
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active staff" value={String(active.length)} hint={`${active.filter((e) => e.payFrequency === "MONTHLY").length} monthly · ${active.filter((e) => e.payFrequency === "WEEKLY").length} weekly`} icon={IdCard} />
        <StatCard label="Base salaries per month" value={formatMoney(monthly)} hint="weekly pay counted as 52 weeks ÷ 12" />
        <StatCard label="Advances to pay back" value={formatMoney(round2(all.reduce((s, e) => s + Math.max(0, advanceOf(e)), 0)))} hint="PVs to 425 Staff advances, less payroll repayments" />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <SearchBar action={base} defaultValue={search.q} placeholder="Search by name or job title" keep={{ left: search.left }} />
        <Link href={search.left ? base : `${base}?left=1`} className="text-sm text-brand hover:underline">
          {search.left ? "Show active staff" : `Show staff who left (${all.length - active.length})`}
        </Link>
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {shown.length === 0 ? (
          <EmptyState icon={IdCard} title={search.left ? "Nobody has left" : needle ? "No staff match this search" : "No staff yet"} description="Add employees, then start a payroll for the month or the week." />
        ) : (
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Job title</th>
                <th className={thClass}>Paid</th>
                <th className={`${thClass} text-right`}>Base salary</th>
                <th className={`${thClass} text-right`}>Advance owed</th>
                <th className={thClass}>Since</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((e) => {
                const owed = advanceOf(e);
                return (
                  <tr key={e.id} className="hover:bg-surface-2/60">
                    <td className={tdClass}>
                      <span className="font-medium text-navy">{e.name}</span>
                      {e.phone && <span className="block text-xs text-muted">{e.phone}</span>}
                    </td>
                    <td className={`${tdClass} text-muted`}>{e.position ?? "—"}</td>
                    <td className={tdClass}>
                      <Badge tone={e.payFrequency === "MONTHLY" ? "blue" : "amber"}>{PAY_FREQUENCIES[e.payFrequency]}</Badge>
                    </td>
                    <td className={`${tdClass} tabular text-right font-semibold`}>
                      {formatMoney(e.baseSalary)}
                      <span className="block text-xs font-normal text-muted">per {e.payFrequency === "MONTHLY" ? "month" : "week"}</span>
                    </td>
                    <td className={`${tdClass} tabular text-right ${owed > 0 ? "font-medium text-amber-700" : "text-muted"}`}>{owed > 0 ? formatMoney(owed) : "—"}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{e.startDate ? dayFormat.format(e.startDate) : "—"}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      <Link href={`${base}?edit=${e.id}`} scroll={false} title="Edit employee" aria-label={`Edit ${e.name}`} className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy">
                        <Pencil className="size-4" aria-hidden />
                      </Link>
                      <ActiveToggle companySlug={slug} employeeId={e.id} name={e.name} active={e.active} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {(search.new || editing) && (
        <Modal title={editing ? `Edit ${editing.name}` : "New employee"} closeHref={base} size="md">
          <EmployeeForm key={crypto.randomUUID()} companySlug={slug} employee={editing} />
        </Modal>
      )}
    </>
  );
}

export default function StaffPage({ params, searchParams }: PageProps<"/c/[company]/staff">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading staff…</p>}>
      <StaffContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
