import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { dayFormat } from "@/lib/dates";
import { listStockCounts } from "@/lib/data/stock-ops";
import { COMPANIES } from "@/lib/permissions";
import { Badge, PageHeader, cardClass, secondaryButton, tdClass, thClass } from "@/components/ui";
import { CountActions, CountSheet } from "../count-forms";

async function CountDetail({ params, searchParams }: { params: Promise<{ company: string; countId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ company, countId }, { saved }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "inventory");
  const count = (await listStockCounts(slug)).find((c) => c.id === countId);
  if (!count) notFound();
  const draft = count.status === "DRAFT";

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Stock count`}
        title={count.number}
        description={`${dayFormat.format(count.countDate)} · by ${count.createdByName}${count.notes ? ` · ${count.notes}` : ""}`}
        action={
          <>
            <a href={`/c/${slug}/inventory/counts/${count.id}/sheet`} target="_blank" rel="noopener" className={secondaryButton}>
              <Printer className="size-4" aria-hidden /> Count sheet
            </a>
            {draft && <CountActions companySlug={slug} countId={count.id} number={count.number} />}
          </>
        }
      />
      {saved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Count saved. Post it when you are done to update the stock.
        </p>
      )}
      <div className="mt-3">
        <Badge tone={draft ? "amber" : "green"}>{draft ? "In progress" : "Posted"}</Badge>
      </div>
      <div className="mt-6">
        {draft ? (
          <CountSheet key={count.lines.map((l) => `${l.id}:${l.counted}`).join()} companySlug={slug} count={count} />
        ) : (
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Product</th>
                  <th className={`${thClass} text-right`}>System</th>
                  <th className={`${thClass} text-right`}>Counted</th>
                  <th className={`${thClass} text-right`}>Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {count.lines
                  .filter((l) => l.counted !== null)
                  .map((l) => {
                    const diff = (l.counted ?? 0) - l.expected;
                    return (
                      <tr key={l.id}>
                        <td className={tdClass}>
                          <span className="font-mono text-xs text-muted">{l.code}</span> {l.name}
                        </td>
                        <td className={`${tdClass} tabular text-right text-muted`}>{l.expected}</td>
                        <td className={`${tdClass} tabular text-right`}>{l.counted}</td>
                        <td className={`${tdClass} tabular text-right font-medium ${diff < 0 ? "text-danger" : diff > 0 ? "text-success" : "text-muted"}`}>{diff > 0 ? `+${diff}` : diff}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function CountPage({ params, searchParams }: PageProps<"/c/[company]/inventory/counts/[countId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CountDetail params={params} searchParams={searchParams as Promise<{ saved?: string }>} />
    </Suspense>
  );
}
