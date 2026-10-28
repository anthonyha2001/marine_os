import { Suspense } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { listPurchases } from "@/lib/data/inventory";
import { formatMoney } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { ButtonLink, PageHeader, cardClass } from "@/components/ui";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

async function PurchasesContent({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { slug } = await requireModule(company, "purchases");
  const purchases = await listPurchases(slug);
  const base = `/c/${slug}/purchases`;

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Purchases"
        description={`Supplier invoices recorded for ${COMPANIES[slug].name}.`}
        action={<ButtonLink icon={Plus} href={`${base}/new`}>New purchase</ButtonLink>}
      />

      <div className={`${cardClass} mt-6 overflow-x-auto`}>
        {purchases.length === 0 ? (
          <p className="p-10 text-center text-muted">No purchases recorded yet.</p>
        ) : (
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Lines</th>
                <th className="px-4 py-3 text-right">Total excl. VAT</th>
                <th className="px-4 py-3 text-right">Total incl. VAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-background/60">
                  <td className="px-4 py-3 whitespace-nowrap">{dateFormat.format(p.purchaseDate)}</td>
                  <td className="px-4 py-3">
                    <Link href={`${base}/${p.id}`} className="font-medium text-brand hover:underline">
                      {p.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{p.supplierName}</td>
                  <td className="px-4 py-3 text-muted">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{p.itemCount}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(p.totalHT)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(p.totalTTC)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function PurchasesPage({ params }: PageProps<"/c/[company]/purchases">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading purchases…</p>}>
      <PurchasesContent params={params} />
    </Suspense>
  );
}
