import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeftRight, Send } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { listProductsWithStock } from "@/lib/data/inventory";
import { listTransfers } from "@/lib/data/stock-ops";
import { formatMoney } from "@/lib/money";
import { COMPANIES, COMPANY_SLUGS } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { Badge, ButtonLink, EmptyState, PageHeader, cardClass, tdClass, thClass } from "@/components/ui";
import { SendTransferForm, TransferActions } from "./transfer-forms";

type Search = { new?: string; t?: string; sent?: string };
const STATUS = { SENT: ["amber", "On the way"], RECEIVED: ["green", "Received"], CANCELLED: ["gray", "Cancelled"] } as const;

async function TransfersContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "inventory");
  const base = `/c/${slug}/inventory/transfers`;
  const other = COMPANY_SLUGS.find((s) => s !== slug)!;
  const [transfers, products] = await Promise.all([listTransfers(slug), search.new ? listProductsWithStock(slug) : []]);
  const incoming = transfers.filter((t) => t.to.slug === slug && t.status === "SENT");
  const open = search.t ? transfers.find((t) => t.id === search.t) : undefined;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Stock`}
        title="Transfers"
        description={`Goods moved between ${COMPANIES[slug].name} and ${COMPANIES[other].name}. Stock and accounts are updated on both sides; the balance between the two companies is in account 458.`}
        action={<ButtonLink icon={Send} href={`${base}?new=1`}>Send to {COMPANIES[other].name}</ButtonLink>}
      />
      {search.sent && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Goods sent. {COMPANIES[other].name} receives them from their Transfers page.
        </p>
      )}
      {incoming.length > 0 && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {incoming.length} transfer{incoming.length === 1 ? "" : "s"} from {COMPANIES[other].name} waiting to be received.
        </p>
      )}
      <div className={`${cardClass} mt-6 overflow-x-auto`}>
        {transfers.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="No transfers yet" description={`Send products to ${COMPANIES[other].name} when they need stock you have.`} />
        ) : (
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Transfer</th>
                <th className={thClass}>Direction</th>
                <th className={thClass}>Sent</th>
                <th className={`${thClass} text-right`}>Items</th>
                <th className={`${thClass} text-right`}>Value at cost</th>
                <th className={thClass}>Status</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transfers.map((t) => {
                const out = t.from.slug === slug;
                return (
                  <tr key={t.id} className="hover:bg-surface-2/60">
                    <td className={tdClass}>
                      <Link href={`${base}?t=${t.id}`} scroll={false} className="font-mono text-xs font-medium text-brand hover:underline">
                        {t.number}
                      </Link>
                    </td>
                    <td className={tdClass}>{out ? `To ${t.to.name}` : `From ${t.from.name}`}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>
                      {dayFormat.format(t.sentDate)} · {t.createdByName}
                    </td>
                    <td className={`${tdClass} tabular text-right`}>{t.lines.reduce((n, l) => n + l.quantity, 0)}</td>
                    <td className={`${tdClass} tabular text-right font-semibold`}>{formatMoney(t.totalCost)}</td>
                    <td className={tdClass}>
                      <Badge tone={STATUS[t.status][0]}>{STATUS[t.status][1]}</Badge>
                    </td>
                    <td className={`${tdClass} text-right`}>{t.status === "SENT" && <TransferActions companySlug={slug} transferId={t.id} number={t.number} side={out ? "OUT" : "IN"} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {search.new && (
        <Modal title={`Send goods to ${COMPANIES[other].name}`} closeHref={base} size="lg">
          <SendTransferForm
            key={crypto.randomUUID()}
            companySlug={slug}
            toCompany={{ slug: other, name: COMPANIES[other].name }}
            products={products.filter((p) => p.stock > 0).map((p) => ({ id: p.id, code: p.code, name: p.name, stock: p.stock, barcodes: p.barcodes }))}
          />
        </Modal>
      )}
      {open && (
        <Modal title={`${open.number} · ${open.from.name} → ${open.to.name}`} closeHref={base} size="lg">
          <p className="text-sm text-muted">
            Sent {dayFormat.format(open.sentDate)} by {open.createdByName}
            {open.receivedDate && ` · received ${dayFormat.format(open.receivedDate)} by ${open.receivedByName}`}
            {open.notes && ` · ${open.notes}`}
          </p>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2">Product</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit cost</th>
                <th className="py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {open.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-2">
                    <span className="font-mono text-xs text-muted">{l.code}</span> {l.name}
                  </td>
                  <td className="tabular py-2 text-right">{l.quantity}</td>
                  <td className="tabular py-2 text-right">{formatMoney(l.unitCost)}</td>
                  <td className="tabular py-2 text-right font-medium">{formatMoney(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}

export default function TransfersPage({ params, searchParams }: PageProps<"/c/[company]/inventory/transfers">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading transfers…</p>}>
      <TransfersContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
