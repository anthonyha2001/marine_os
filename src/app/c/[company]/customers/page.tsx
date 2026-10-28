import { Suspense } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PortalLinkButton } from "@/components/share-link";
import { requireModule } from "@/lib/auth";
import { customerBalances, type CustomerBalance } from "@/lib/data/ledger";
import { listCustomers } from "@/lib/data/sales";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES, canAccessModule } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { ButtonLink, PageHeader, cardClass } from "@/components/ui";
import { CustomerForm } from "./customer-form";

async function CustomersContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ new?: string; added?: string; sort?: string }>;
}) {
  const [{ company }, { new: creating, added, sort }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "customers");
  // Amounts due come from invoices, so only people who may see invoices see them.
  const showDue = canAccessModule(user, slug, "invoices");
  const [customerList, balances] = await Promise.all([
    listCustomers(),
    showDue ? customerBalances(slug) : new Map<string, CustomerBalance>(),
  ]);
  const base = `/c/${slug}/customers`;

  const balanceOf = (c: { id: string; name: string }): CustomerBalance => {
    const byId = balances.get(c.id);
    const byName = balances.get(`name:${c.name.trim().toLowerCase()}`);
    return {
      due: round2((byId?.due ?? 0) + (byName?.due ?? 0)),
      overdue: round2((byId?.overdue ?? 0) + (byName?.overdue ?? 0)),
      unpaidCount: (byId?.unpaidCount ?? 0) + (byName?.unpaidCount ?? 0),
    };
  };
  const customers = customerList.map((c) => ({ ...c, balance: balanceOf(c) }));
  if (sort === "due") customers.sort((a, b) => b.balance.due - a.balance.due || a.name.localeCompare(b.name));
  const totalDue = round2(customers.reduce((sum, c) => sum + c.balance.due, 0));
  const totalOverdue = round2(customers.reduce((sum, c) => sum + c.balance.overdue, 0));
  const owing = customers.filter((c) => c.balance.due > 0).length;

  return (
    <>
      <PageHeader
        title="Customers"
        description="Shared by both companies. Customers typed on an offer are saved here automatically."
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
              ["Customers owing", String(owing), `of ${customers.length}`],
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
            <Link href={base} className={sort === "due" ? "text-brand hover:underline" : "font-semibold text-navy"}>
              Name
            </Link>
            <Link href={`${base}?sort=due`} className={sort === "due" ? "font-semibold text-navy" : "text-brand hover:underline"}>
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

      <section className={`${cardClass} mt-4 divide-y divide-border`}>
        {customers.length === 0 && <p className="p-10 text-center text-muted">No customers yet.</p>}
        {customers.map((c) => (
          <details key={c.id} className="group">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-background/60">
              <span>
                <span className="block font-medium text-navy">{c.name}</span>
                <span className="block text-xs text-muted">
                  {[c.contactName, c.phone, c.email].filter(Boolean).join(" · ") || "No details"}
                </span>
              </span>
              <span className="flex items-center gap-5">
                {showDue &&
                  (c.balance.due > 0 ? (
                    <Link
                      href={`/c/${slug}/invoices?q=${encodeURIComponent(c.name)}`}
                      className="text-right hover:underline"
                      title="See this customer's invoices"
                    >
                      <span className="block text-sm font-semibold text-navy">{formatMoney(c.balance.due)} due</span>
                      <span className={`block text-xs ${c.balance.overdue > 0 ? "font-medium text-danger" : "text-muted"}`}>
                        {c.balance.overdue > 0
                          ? `${formatMoney(c.balance.overdue)} overdue`
                          : `${c.balance.unpaidCount} unpaid invoice${c.balance.unpaidCount === 1 ? "" : "s"}`}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-xs text-muted">Nothing due</span>
                  ))}
                <span className="text-xs font-medium text-brand group-open:hidden">Edit</span>
                <span className="hidden text-xs font-medium text-muted group-open:inline">Close</span>
              </span>
            </summary>
            <div className="max-w-2xl border-t border-border bg-background/40 p-5">
              <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-muted">
                  Customer portal: <PortalLinkButton companySlug={slug} customerId={c.id} hasLink={!!c.portalToken} token={c.portalToken} />
                  <span className="text-xs">{c.portalToken ? "link active" : "no link yet"}</span>
                </span>
                <Link href={`/c/${slug}/vessels?q=${encodeURIComponent(c.name)}`} className="text-brand hover:underline">
                  Boats →
                </Link>
              </div>
              <CustomerForm companySlug={slug} customer={c} />
            </div>
          </details>
        ))}
      </section>
    </>
  );
}

export default function CustomersPage({ params, searchParams }: PageProps<"/c/[company]/customers">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CustomersContent params={params} searchParams={searchParams as Promise<{ new?: string; added?: string; sort?: string }>} />
    </Suspense>
  );
}
