import { Suspense } from "react";
import Link from "next/link";
import { Hash, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { getCatalogue, listPurchases } from "@/lib/data/inventory";
import { listCustomers } from "@/lib/data/sales";
import { SERIAL_STATUS, listSerials, type SerialStatus } from "@/lib/data/serials";
import { vesselOptions } from "@/lib/data/vessels";
import { COMPANIES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Modal } from "@/components/modal";
import { Badge, ButtonLink, EmptyState, PageHeader, SearchBar, cardClass, secondaryButtonSm, tdClass, thClass } from "@/components/ui";
import { LinkTabs } from "../../finance/finance-ui";
import { RegisterSerialsForm, SellSerialForm, SerialActions } from "./serial-forms";

type Search = { q?: string; new?: string; product?: string; purchase?: string; sell?: string; saved?: string; show?: string };
const TONE: Record<SerialStatus, "green" | "blue" | "amber" | "gray"> = { IN_STOCK: "green", SOLD: "blue", RETURNED: "amber", SCRAPPED: "gray" };

async function SerialsContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "inventory");
  const base = `/c/${slug}/inventory/serials`;
  const all = await listSerials(slug);
  const needle = (search.q ?? "").trim().toLowerCase();
  const show = search.show && search.show in SERIAL_STATUS ? (search.show as SerialStatus) : search.show === "all" || needle ? "all" : "IN_STOCK";
  const shown = all
    .filter((s) => show === "all" || s.status === show)
    .filter((s) => !needle || [s.serialNumber, s.product.name, s.product.code, s.customerName ?? "", s.vessel?.name ?? "", s.soldRef ?? ""].some((t) => t.toLowerCase().includes(needle)));
  const selling = search.sell ? all.find((s) => s.id === search.sell && s.status === "IN_STOCK") : undefined;

  const [catalogue, purchases, customers, vessels] = await Promise.all([
    search.new ? getCatalogue() : [],
    search.new ? listPurchases(slug) : [],
    selling ? listCustomers() : [],
    selling ? vesselOptions() : [],
  ]);
  const tracked = catalogue.filter((c) => c.trackSerials && c.type === "PRODUCT");
  const purchaseItems = search.new
    ? await prisma.purchaseItem.findMany({ where: { purchaseId: { in: purchases.map((p) => p.id) }, productId: { in: tracked.map((t) => t.id) } }, select: { purchaseId: true, productId: true } })
    : [];

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Stock`}
        title="Serial numbers"
        description="Each engine or outboard by its serial number: which purchase it came from, and who it was sold to. Search a serial when a customer calls."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>Register serials</ButtonLink>}
      />
      {search.saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          {search.saved} serial number{search.saved === "1" ? "" : "s"} registered.
        </p>
      )}
      <div className="mt-6 space-y-4">
        <LinkTabs
          active={show}
          tabs={[
            { key: "IN_STOCK", label: `In stock (${all.filter((s) => s.status === "IN_STOCK").length})`, href: base },
            { key: "SOLD", label: `Sold (${all.filter((s) => s.status === "SOLD").length})`, href: `${base}?show=SOLD` },
            { key: "all", label: `All (${all.length})`, href: `${base}?show=all` },
          ]}
        />
        <SearchBar action={base} defaultValue={search.q} placeholder="Search a serial number, product, customer or vessel" />
      </div>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {shown.length === 0 ? (
          <EmptyState icon={Hash} title={needle ? "No serial number matches" : "Nothing here"} description="Tick “Track serial numbers” on a product, then register the serials when the goods arrive." />
        ) : (
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Serial number</th>
                <th className={thClass}>Product</th>
                <th className={thClass}>Bought</th>
                <th className={thClass}>Sold to</th>
                <th className={thClass}>Status</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((s) => (
                <tr key={s.id} className="hover:bg-surface-2/60">
                  <td className={`${tdClass} font-mono font-medium text-navy`}>{s.serialNumber}</td>
                  <td className={tdClass}>
                    <span className="font-mono text-xs text-muted">{s.product.code}</span> {s.product.name}
                  </td>
                  <td className={`${tdClass} text-muted`}>
                    {s.purchase ? (
                      <Link href={`/c/${slug}/purchases/${s.purchase.id}`} className="hover:underline">
                        {s.purchase.supplier} · {s.purchase.invoiceNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={tdClass}>
                    {s.customerName ?? "—"}
                    {(s.vessel || s.soldAt) && (
                      <span className="block text-xs text-muted">
                        {[s.vessel?.name, s.soldAt && dayFormat.format(s.soldAt), s.soldRef].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <Badge tone={TONE[s.status]}>{SERIAL_STATUS[s.status]}</Badge>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    {s.status === "IN_STOCK" && (
                      <Link href={`${base}?sell=${s.id}`} scroll={false} className={`${secondaryButtonSm} mr-1`}>
                        Sold to…
                      </Link>
                    )}
                    <SerialActions companySlug={slug} serialId={s.id} serialNumber={s.serialNumber} status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {search.new && (
        <Modal title="Register serial numbers" closeHref={base} size="md">
          <RegisterSerialsForm
            key={crypto.randomUUID()}
            companySlug={slug}
            products={tracked.map((t) => ({ id: t.id, label: `${t.code} · ${t.name}` }))}
            purchases={purchases
              .filter((p) => purchaseItems.some((i) => i.purchaseId === p.id))
              .map((p) => ({ id: p.id, label: `${p.supplierName} · ${p.invoiceNumber} · ${dayFormat.format(p.purchaseDate)}`, productIds: purchaseItems.filter((i) => i.purchaseId === p.id).map((i) => i.productId) }))}
            defaults={{ productId: search.product, purchaseId: search.purchase }}
          />
        </Modal>
      )}
      {selling && (
        <Modal title={`Sold: ${selling.product.name} · S/N ${selling.serialNumber}`} closeHref={base} size="md">
          <SellSerialForm key={crypto.randomUUID()} companySlug={slug} serialId={selling.id} serialNumber={selling.serialNumber} customers={customers.map((c) => ({ id: c.id, name: c.name }))} vessels={vessels} />
        </Modal>
      )}
    </>
  );
}

export default function SerialsPage({ params, searchParams }: PageProps<"/c/[company]/inventory/serials">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading serial numbers…</p>}>
      <SerialsContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
