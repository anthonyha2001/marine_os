import { Suspense } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { LIST_PAGE_SIZE, customerPage } from "@/lib/data/lists";
import { businessToday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { withParams } from "@/lib/url";
import { Pager, pageFrom } from "@/components/pager";
import { COMPANIES, canAccessModule } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { ButtonLink, PageHeader, SearchBar, cardClass } from "@/components/ui";
import { CustomerForm } from "./customer-form";

async function CustomersContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ new?: string; added?: string; sort?: string; q?: string; page?: string }>;
}) {
  const [{ company }, { new: creating, added, sort, q = "", page: pageParam }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "customers");
  // Amounts due come from invoices, so only people who may see invoices see them.
  const showDue = canAccessModule(user, slug, "invoices");
  const page = pageFrom(pageParam);
  const byDue = showDue && sort === "due";
  const list = await customerPage(slug, businessToday(), q, byDue ? "due" : "name", page);
  const customers = list.rows;
  const { totalDue, totalOverdue, owing } = list;
  const base = `/c/${slug}/customers`;
  const here = withParams(base, { q: q || null, sort: byDue ? "due" : null });

  return (
    <>
      <PageHeader
        title="Customers"
        description="Shared by both companies. Click a customer to see their boats, offers, jobs, invoices and payments."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New customer</ButtonLink>}
      />

      {added && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
          {added} was added.
        </p>
      )}

      {showDue && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Total due", formatMoney(totalDue), `to ${COMPANIES[slug].name}`],
              ["Overdue", formatMoney(totalOverdue), "past the due date"],
              ["Customers owing", String(owing), `of ${list.total}`],
            ].map(([label, value, hint]) => (
              <div key={label} className={`${cardClass} p-4`}>
                <p className="text-sm text-muted">{label}</p>
                <p className={`mt-1 text-2xl font-semibold ${label === "Overdue" && totalOverdue > 0 ? "text-danger" : "text-navy"}`}>{value}</p>
                <p className="text-xs text-muted">{hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3 text-sm">
            <span className="text-muted">Sort:</span>
            <Link href={withParams(here, { sort: null })} className={sort === "due" ? "text-brand hover:underline" : "font-semibold text-navy"}>
              Name
            </Link>
            <Link href={withParams(here, { sort: "due" })} className={sort === "due" ? "font-semibold text-navy" : "text-brand hover:underline"}>
              Amount due
            </Link>
          </div>
        </>
      )}

      {creating && (
        <Modal title="New customer" closeHref={base} size="md">
          <div className={`${cardClass} p-5`}>
            <CustomerForm key={crypto.randomUUID()} companySlug={slug} />
          </div>
        </Modal>
      )}

      <div className="mt-6">
        <SearchBar action={base} defaultValue={q} placeholder="Search by name, contact, phone or email" keep={{ sort: byDue ? "due" : undefined }} />
      </div>

      <section className={`${cardClass} mt-4 divide-y divide-border`}>
        {customers.length === 0 && <p className="p-10 text-center text-muted">{q ? "No customers match this search." : "No customers yet."}</p>}
        {customers.map((c) => (
          <Link key={c.id} href={`${base}/${c.id}`} data-nav-row className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 hover:bg-background/60">
            <span>
              <span className="block font-medium text-navy">{c.name}</span>
              <span className="block text-xs text-muted">{[c.contactName, c.phone, c.email].filter(Boolean).join(" · ") || "No details"}</span>
            </span>
            {showDue &&
              (c.balance.due > 0 ? (
                <span className="text-right">
                  <span className="block text-sm font-semibold text-navy">{formatMoney(c.balance.due)} due</span>
                  <span className={`block text-xs ${c.balance.overdue > 0 ? "font-medium text-danger" : "text-muted"}`}>
                    {c.balance.overdue > 0
                      ? `${formatMoney(c.balance.overdue)} overdue`
                      : `${c.balance.unpaidCount} unpaid invoice${c.balance.unpaidCount === 1 ? "" : "s"}`}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-muted">Nothing due</span>
              ))}
          </Link>
        ))}
      </section>
      <Pager href={here} page={page} pageSize={LIST_PAGE_SIZE} total={list.total} />
    </>
  );
}

export default function CustomersPage({ params, searchParams }: PageProps<"/c/[company]/customers">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CustomersContent params={params} searchParams={searchParams as Promise<{ new?: string; added?: string; sort?: string; q?: string; page?: string }>} />
    </Suspense>
  );
}
