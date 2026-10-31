import { Suspense } from "react";
import Link from "next/link";
import { ArchiveRestore, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { COMPANIES, isAdmin } from "@/lib/permissions";
import { EmptyState, PageHeader, cardClass, tdClass, thClass } from "@/components/ui";
import { BinActions, EmptyDatabaseForm } from "./bin-forms";

const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Beirut" });

const KIND: Record<string, string> = {
  SupplierPayment: "Supplier payment",
  CustomerReceipt: "Receipt",
  Voucher: "Voucher",
  JournalEntry: "Journal entry",
  LedgerAccount: "Account",
  Offer: "Offer",
  OfferClause: "Clause",
  PayrollRun: "Payroll",
  Product: "Product / service",
  PurchaseOrder: "Purchase order",
  LandedCost: "Landed cost",
  ProductSerial: "Serial number",
  StockCount: "Stock count",
  JobCard: "Job card",
};

async function BinContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ view?: string }> }) {
  const [{ company }, { view }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "recycleBin");
  const companyId = await companyIdFor(slug);
  const restored = view === "restored";
  const items = await prisma.recycleBinItem.findMany({
    where: { OR: [{ companyId }, { companyId: null }], restoredAt: restored ? { not: null } : null },
    select: { id: true, entity: true, label: true, deletedByName: true, deletedAt: true, restoredAt: true, restoredByName: true },
    orderBy: restored ? { restoredAt: "desc" } : { deletedAt: "desc" },
    take: 300,
  });
  const base = `/c/${slug}/recycle-bin`;
  const admin = isAdmin(user);

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Settings`}
        title="Recycle bin"
        description="Everything deleted in the system lands here, with its lines and accounting entries. Restore puts it back exactly as it was."
      />

      <div className="mt-6 flex gap-2 text-sm" role="tablist">
        {[
          ["In the bin", base, !restored],
          ["Restored", `${base}?view=restored`, restored],
        ].map(([label, href, active]) => (
          <Link
            key={String(label)}
            href={String(href)}
            role="tab"
            aria-selected={Boolean(active)}
            className={`rounded-full px-3 py-1.5 font-medium ${active ? "bg-navy text-white" : "border border-border bg-surface text-slate-700 hover:bg-surface-2"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {items.length === 0 ? (
          <EmptyState icon={ArchiveRestore} title={restored ? "Nothing restored yet" : "The recycle bin is empty"} description="Deleted offers, vouchers, payments, products and more appear here." />
        ) : (
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>What</th>
                <th className={thClass}>Type</th>
                <th className={thClass}>{restored ? "Restored" : "Deleted"}</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className={`${tdClass} font-medium text-navy`}>{i.label}</td>
                  <td className={`${tdClass} text-muted`}>{KIND[i.entity] ?? i.entity}</td>
                  <td className={`${tdClass} text-muted`}>
                    {restored && i.restoredAt ? `${stamp.format(i.restoredAt)} by ${i.restoredByName}` : `${stamp.format(i.deletedAt)} by ${i.deletedByName}`}
                  </td>
                  <td className={tdClass}>{!restored && <BinActions companySlug={slug} itemId={i.id} label={i.label} canPurge={admin} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {admin && (
        <section className="mt-10 rounded-xl border border-red-200 bg-red-50/60 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-danger">
            <TriangleAlert className="size-5" aria-hidden /> Empty the database
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Deletes all business data of <strong>both companies</strong>: customers, suppliers, products, stock, offers, invoices, purchases, payments, POS sales,
            staff, payroll, vessels, job cards, journal entries, the audit log and this recycle bin. The companies, user logins, chart of accounts and settings
            stay. <strong>This can&apos;t be undone.</strong>
          </p>
          <div className="mt-4">
            <EmptyDatabaseForm companySlug={slug} />
          </div>
        </section>
      )}
    </>
  );
}

export default function RecycleBinPage({ params, searchParams }: PageProps<"/c/[company]/recycle-bin">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <BinContent params={params} searchParams={searchParams as Promise<{ view?: string }>} />
    </Suspense>
  );
}
