import { Suspense } from "react";
import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { listStockCounts } from "@/lib/data/stock-ops";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { Badge, ButtonLink, EmptyState, PageHeader, cardClass, tdClass, thClass } from "@/components/ui";
import { NewCountForm } from "./count-forms";

async function CountsContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ new?: string }> }) {
  const [{ company }, { new: creating }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "inventory");
  const base = `/c/${slug}/inventory/counts`;
  const counts = await listStockCounts(slug);

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Inventory`}
        title="Stock counts"
        description="Count what is really on the shelves, then post: the system stock is corrected to the counted quantities."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New count</ButtonLink>}
      />
      <div className={`${cardClass} mt-6 overflow-x-auto`}>
        {counts.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No stock counts yet" description="Start one for the whole stock or a part of it (a supplier, a shelf)." />
        ) : (
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Count</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Note</th>
                <th className={`${thClass} text-right`}>Counted</th>
                <th className={`${thClass} text-right`}>Difference value</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {counts.map((c) => {
                const done = c.lines.filter((l) => l.counted !== null);
                const value = round2(done.reduce((s, l) => s + ((l.counted ?? 0) - l.expected) * l.priceHT, 0));
                return (
                  <tr key={c.id} className="hover:bg-surface-2/60">
                    <td className={tdClass}>
                      <Link href={`${base}/${c.id}`} className="font-mono text-xs font-medium text-brand hover:underline">
                        {c.number}
                      </Link>
                    </td>
                    <td className={`${tdClass} text-muted`}>{dayFormat.format(c.countDate)}</td>
                    <td className={`${tdClass} text-muted`}>{c.notes ?? "—"}</td>
                    <td className={`${tdClass} tabular text-right`}>
                      {done.length} / {c.lines.length}
                    </td>
                    <td className={`${tdClass} tabular text-right ${value < 0 ? "text-danger" : ""}`}>{formatMoney(value)}</td>
                    <td className={tdClass}>
                      <Badge tone={c.status === "POSTED" ? "green" : "amber"}>{c.status === "POSTED" ? "Posted" : "In progress"}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {creating && (
        <Modal title="New stock count" closeHref={base} size="md">
          <NewCountForm key={crypto.randomUUID()} companySlug={slug} />
        </Modal>
      )}
    </>
  );
}

export default function CountsPage({ params, searchParams }: PageProps<"/c/[company]/inventory/counts">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading counts…</p>}>
      <CountsContent params={params} searchParams={searchParams as Promise<{ new?: string }>} />
    </Suspense>
  );
}
