import { Suspense } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { listProductsWithStock, listSuppliers } from "@/lib/data/inventory";
import { formatMoney, withVat } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { cardClass, PageHeader, ButtonLink, StockBadge, SavedNotice, SearchBar } from "@/components/ui";
import { ProductForm } from "./product-form";

async function InventoryContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ q?: string; status?: string; saved?: string; new?: string }>;
}) {
  const { company } = await params;
  const { q = "", status = "", saved, new: creating } = await searchParams;
  const { slug } = await requireModule(company, "inventory");

  const [all, suppliers] = await Promise.all([listProductsWithStock(slug, q), creating ? listSuppliers() : []]);
  const products = status ? all.filter((p) => p.status === status) : all;
  const counts = {
    total: all.length,
    low: all.filter((p) => p.status === "low").length,
    out: all.filter((p) => p.status === "out").length,
  };
  const base = `/c/${slug}/inventory`;
  const filterHref = (s: string) => `${base}?${new URLSearchParams({ ...(q ? { q } : {}), ...(s ? { status: s } : {}) })}`;

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Inventory"
        description="Products are shared by both companies. Stock shown here is for this company."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New product</ButtonLink>}
      />

      {saved && !creating && <SavedNotice code={saved} />}

      {creating && (
        <Modal title="New product" closeHref={base} size="xl">
          {saved && <SavedNotice code={saved} />}
          {/* New key per open: an empty form every time, including after "save & add another". */}
          <ProductForm key={crypto.randomUUID()} companySlug={slug} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
        </Modal>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Products", value: counts.total, s: "" },
          { label: "Low stock", value: counts.low, s: "low" },
          { label: "Out of stock", value: counts.out, s: "out" },
        ].map((card) => (
          <Link
            key={card.label}
            href={filterHref(card.s)}
            className={`${cardClass} p-4 transition hover:border-brand ${status === card.s ? "border-brand ring-2 ring-brand/15" : ""}`}
          >
            <p className="text-sm text-muted">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-navy">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <SearchBar action={base} defaultValue={q} placeholder="Search by name, 4-digit code or barcode" keep={{ status }} />
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {products.length === 0 ? (
          <p className="p-10 text-center text-muted">
            {q || status ? "No products match this filter." : "No products yet. Create the first one."}
          </p>
        ) : (
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Price excl. VAT</th>
                <th className="px-4 py-3 text-right">Price TTC</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Min.</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-background/60">
                  <td className="px-4 py-3">
                    <Link href={`${base}/${p.id}`} className="flex items-center gap-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg border border-border object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-background text-xs text-muted">
                          —
                        </span>
                      )}
                      <span>
                        <span className="block font-medium text-navy hover:underline">{p.name}</span>
                        <span className="block text-xs text-muted">{p.barcodes.join(", ")}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono">{p.code}</td>
                  <td className="px-4 py-3 text-muted">{p.supplierName ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(p.priceHT)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(withVat(p.priceHT))}</td>
                  <td className="px-4 py-3 text-right font-semibold">{p.stock}</td>
                  <td className="px-4 py-3 text-right text-muted">{p.minQuantity}</td>
                  <td className="px-4 py-3">
                    <StockBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function InventoryPage({ params, searchParams }: PageProps<"/c/[company]/inventory">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading inventory…</p>}>
      <InventoryContent
        params={params}
        searchParams={searchParams as Promise<{ q?: string; status?: string; saved?: string; new?: string }>}
      />
    </Suspense>
  );
}
