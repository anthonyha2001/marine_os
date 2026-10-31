import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { listSales, listShifts } from "@/lib/data/pos";
import { formatMoney, round2 } from "@/lib/money";
import { formatLbp, hasPos, shiftDifference } from "@/lib/pos";
import { COMPANIES } from "@/lib/permissions";
import { Badge, EmptyState, PageHeader, cardClass, tdClass, thClass } from "@/components/ui";

const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Beirut" });

async function ShiftsContent({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { user, slug } = await requireModule(company, "sales");
  if (!hasPos(slug)) notFound();
  const [allShifts, sales] = await Promise.all([listShifts(slug), listSales(slug)]);
  const shifts = user.role === "CASHIER" ? allShifts.filter((s) => s.cashierId === user.id) : allShifts;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Point of sale`}
        title="Shifts & reports"
        description="Every till session: opening float, takings, cash counted at closing and any difference. Open one for its Z report."
      />
      <div className={`${cardClass} mt-6 overflow-x-auto`}>
        {shifts.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No shifts yet" description="A shift starts when a cashier opens the till." />
        ) : (
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Shift</th>
                <th className={thClass}>Cashier</th>
                <th className={thClass}>Opened</th>
                <th className={thClass}>Closed</th>
                <th className={`${thClass} text-right`}>Sales</th>
                <th className={`${thClass} text-right`}>Counted</th>
                <th className={`${thClass} text-right`}>Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shifts.map((s) => {
                const own = sales.filter((x) => x.shiftId === s.id);
                const diff = shiftDifference(s);
                return (
                  <tr key={s.id} className="hover:bg-surface-2/60">
                    <td className={tdClass}>
                      <Link href={`/c/${slug}/pos/shifts/${s.id}`} className="font-mono text-xs font-medium text-brand hover:underline">
                        {s.number}
                      </Link>
                      {s.status === "OPEN" && (
                        <span className="ml-2">
                          <Badge tone="green">Open</Badge>
                        </span>
                      )}
                    </td>
                    <td className={`${tdClass} font-medium text-navy`}>{s.cashierName}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{stamp.format(s.openedAt)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{s.closedAt ? stamp.format(s.closedAt) : "—"}</td>
                    <td className={`${tdClass} tabular text-right`}>
                      {formatMoney(round2(own.reduce((n, x) => n + x.totalTTC, 0)))}
                      <span className="block text-xs text-muted">{own.length} sales</span>
                    </td>
                    <td className={`${tdClass} tabular text-right text-muted`}>
                      {s.countedUsd === null ? "—" : formatMoney(s.countedUsd)}
                      {s.countedLbp !== null && <span className="block text-xs">{formatLbp(s.countedLbp)}</span>}
                    </td>
                    <td className={`${tdClass} tabular text-right font-semibold ${diff === null ? "" : diff < 0 ? "text-danger" : diff > 0 ? "text-amber-700" : "text-success"}`}>
                      {diff === null ? "—" : diff === 0 ? "Balanced" : `${diff < 0 ? "Short" : "Over"} ${formatMoney(Math.abs(diff))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function ShiftsPage({ params }: PageProps<"/c/[company]/pos/shifts">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading shifts…</p>}>
      <ShiftsContent params={params} />
    </Suspense>
  );
}
