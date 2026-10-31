import { Suspense } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { listProductsWithStock, listSuppliers } from "@/lib/data/inventory";
import { formatMoney, withVat } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { OpenRow } from "@/components/open-row";
import { withParams } from "@/lib/url";
import { ImageOff, Pencil } from "lucide-react";
import { cardClass, PageHeader, ButtonLink, StockBadge, SavedNotice, SearchBar, primaryButton } from "@/components/ui";
import { ProductForm } from "./product-form";

async function InventoryContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ q?: string; status?: string; saved?: string; new?: string; view?: string }>;
}) {
  const { company } = await params;
  const { q = "", status = "", saved, new: creating, view } = await searchParams;
  const { slug } = await requireModule(company, "inventory");

  const [all, suppliers] = await Promise.all([listProductsWithStock(slug, q), creating ? listSuppliers() : []]);
  const products = status ? all.filter((p) => p.status === status) : all;
  const counts = {
    total: all.length,
    low: all.filter((p) => p.status === "low").length,
    out: all.filter((p) => p.status === "out").length,
  };
  const base = `/c/${slug}/inventory`;
  // This list as shown (search + filter), so the product pop-up closes back to it.
  const listHref = withParams(base, { q: q || null, status: status || null });
  const viewing = view ? products.find((p) => p.id === view) : undefined;
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
                <OpenRow key={p.id} href={withParams(listHref, { view: p.id })} className="hover:bg-background/60">
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
                </OpenRow>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewing && (
        <Modal title={viewing.name} closeHref={listHref} size="lg">
          <div className="grid gap-5 sm:grid-cols-[16rem_1fr]">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
              {viewing.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- product photos are stored as plain URLs
                <img src={viewing.imageUrl} alt={viewing.name} className="h-full w-full object-contain" />
              ) : (
                <span className="flex flex-col items-center gap-2 p-4 text-center text-xs text-muted">
                  <ImageOff className="size-8" aria-hidden />
                  No photo yet. Add one with Edit.
                </span>
              )}
            </div>
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {(
                  [
                    ["Code", <span key="c" className="font-mono">{viewing.code}</span>],
                    ["Barcode", <span key="b" className="font-mono">{viewing.barcodes.join(", ") || "—"}</span>],
                    ["Price excl. VAT", formatMoney(viewing.priceHT)],
                    ["Price incl. VAT", <span key="t" className="text-lg">{formatMoney(withVat(viewing.priceHT))}</span>],
                    ["In stock", <span key="s" className={viewing.stock > 0 ? "" : "text-danger"}>{viewing.stock}</span>],
                    ["Minimum", viewing.minQuantity],
                    ["Supplier", viewing.supplierName ?? "—"],
                    ["Status", <StockBadge key="st" status={viewing.status} />],
                  ] as [string, React.ReactNode][]
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
                    <dd className="mt-0.5 font-semibold text-navy">{value}</dd>
                  </div>
                ))}
              </dl>
              {viewing.description && <p className="whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm text-slate-700">{viewing.description}</p>}
              <div className="flex justify-end border-t border-border pt-4">
                <Link href={`${base}/${viewing.id}`} className={primaryButton}>
                  <Pencil className="size-4" aria-hidden /> Edit product
                </Link>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function InventoryPage({ params, searchParams }: PageProps<"/c/[company]/inventory">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading inventory…</p>}>
      <InventoryContent
        params={params}
        searchParams={searchParams as Promise<{ q?: string; status?: string; saved?: string; new?: string; view?: string }>}
      />
    </Suspense>
  );
}
