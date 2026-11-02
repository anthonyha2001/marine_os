import { Suspense } from "react";
import { Plus, ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Modal } from "@/components/modal";
import { ClauseLibrary } from "./clause-library";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { LIST_PAGE_SIZE, offerPage } from "@/lib/data/lists";
import { businessToday } from "@/lib/dates";
import { Pager, pageFrom } from "@/components/pager";
import { formatMoney } from "@/lib/money";

import { COMPANIES, can, canAccessModule, isAdmin } from "@/lib/permissions";
import { cardClass, PageHeader, ButtonLink, SearchBar, secondaryButton } from "@/components/ui";
import { deleteOffer } from "@/lib/actions/offers";
import { DeleteButton } from "@/components/delete-button";
import { OfferDialog } from "@/components/document-dialogs";
import { withParams } from "@/lib/url";
import { OpenRow } from "@/components/open-row";
import { StatusSelect } from "./status-select";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

async function OffersContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ q?: string; clauses?: string; view?: string; invoice?: string; page?: string }>;
}) {
  const [{ company }, { q = "", clauses, view, invoice, page: pageParam }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "offers");
  const mayDelete = (status: string) => isAdmin(user) || (status === "DRAFT" && can(user, "deleteDrafts"));
  const page = pageFrom(pageParam);
  const list = await offerPage(slug, q, page);
  const offers = list.rows;
  const base = `/c/${slug}/offers`;
  // This list's address (search and page), kept when a row's pop-up opens and closes.
  const here = withParams(base, { q: q || null, page: page > 1 ? String(page) : null });
  const today = businessToday();

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Offers"
        description="Quotations sent to customers by this company."
        action={
          <>
            <Link href={`${base}?clauses=1`} scroll={false} className={secondaryButton}>
              <ScrollText className="size-4" aria-hidden /> Standard clauses
            </Link>
            <ButtonLink icon={Plus} href={`${base}/new`}>New offer</ButtonLink>
          </>
        }
      />

      <div className="mt-6">
        <SearchBar action={base} defaultValue={q} placeholder="Search by number, customer or subject" />
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {offers.length === 0 ? (
          <p className="p-10 text-center text-muted">{q ? "No offers match this search." : "No offers yet. Use + New to create one."}</p>
        ) : (
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="w-16 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {offers.map((o) => {
                const expired = o.status !== "ACCEPTED" && o.status !== "REJECTED" && o.validUntil.toISOString().slice(0, 10) < today;
                return (
                  <OpenRow key={o.id} href={withParams(here, { view: o.id })} className="hover:bg-background/60">
                    <td className="px-4 py-3">
                      <Link href={`${base}/${o.id}`} className="font-mono font-medium text-brand hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{dateFormat.format(o.offerDate)}</td>
                    <td className="px-4 py-3 font-medium text-navy">{o.customerName}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted">{o.subject ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusSelect companySlug={slug} offerId={o.id} status={o.status} />
                      {expired && <span className="ml-2 text-xs text-danger">Expired</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(o.totalTTC)}</td>
                    <td className="px-2 py-3 text-right">
                      {/* Offers with invoices (even cancelled ones) can't be deleted. */}
                      {o.invoiceCount === 0 && mayDelete(o.status) && (
                        <DeleteButton
                          action={deleteOffer.bind(null, slug, o.id)}
                          confirmText={`Delete offer ${o.number} for ${o.customerName}? It goes to the recycle bin and can be restored.`}
                          title="Delete offer"
                        />
                      )}
                    </td>
                  </OpenRow>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Pager href={here} page={page} pageSize={LIST_PAGE_SIZE} total={list.total} />

      {view && (
        <OfferDialog
          slug={slug}
          id={view}
          closeHref={here}
          selfHref={withParams(here, { view })}
          invoicing={invoice === "1"}
          canInvoice={canAccessModule(user, slug, "invoices")}
        />
      )}

      {clauses && (
        <Modal title="Standard clauses" closeHref={base} size="lg">
          <ClauseLibrary
            companySlug={slug}
            clauses={await prisma.offerClause.findMany({ where: { company: { slug } }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, text: true } })}
          />
        </Modal>
      )}
    </>
  );
}

export default function OffersPage({ params, searchParams }: PageProps<"/c/[company]/offers">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading offers…</p>}>
      <OffersContent params={params} searchParams={searchParams as Promise<{ q?: string; clauses?: string; view?: string; page?: string }>} />
    </Suspense>
  );
}
