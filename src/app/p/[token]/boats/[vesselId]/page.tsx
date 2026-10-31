import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Gauge, Hammer, Receipt, ShieldCheck } from "lucide-react";
import { businessToday, dayFormat } from "@/lib/dates";
import { APPOINTMENT_STATUS, JOB_STAGES, jobStage, portalBoat, portalCustomer } from "@/lib/data/portal";
import { formatMoney } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Badge, primaryButton, secondaryButton } from "@/components/ui";
import { Card, Empty, PageHead, RowLink } from "../../_parts";
import { EngineHoursForm } from "../../portal-forms";

async function Boat({ params }: { params: Promise<{ token: string; vesselId: string }> }) {
  const { token, vesselId } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const data = await portalBoat(customer.id, vesselId);
  if (!data) notFound();
  const { boat, jobs, invoices, warranties, appointments } = data;
  const base = `/p/${token}`;
  const today = businessToday();
  const facts = (
    [
      ["Type", boat.type],
      ["Builder", boat.make],
      ["Model", boat.model],
      ["Year", boat.year],
      ["Length", boat.lengthM ? `${boat.lengthM} m` : null],
      ["Registration", boat.registration],
      ["Hull number", boat.hullNumber],
      ["Home port", boat.homePort],
    ] as [string, string | number | null][]
  ).filter(([, v]) => v !== null && v !== "");

  return (
    <>
      <Link href={`${base}/boats`} className="text-sm text-brand hover:underline">
        ← My boats
      </Link>
      <div className="mt-3">
        <PageHead
          title={boat.name}
          sub={[boat.type, boat.make, boat.model].filter(Boolean).join(" · ") || undefined}
          action={
            <div className="flex flex-wrap gap-2">
              <Link href={`${base}/appointments?boat=${boat.id}#book`} className={primaryButton}>
                <CalendarDays className="size-4" aria-hidden /> Book a service
              </Link>
              <Link href={`${base}/messages/new?boat=${boat.id}`} className={secondaryButton}>
                Ask about this boat
              </Link>
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title="Service history" icon={Hammer}>
            {jobs.length === 0 ? (
              <Empty>No work recorded on this boat yet.</Empty>
            ) : (
              <ol className="relative ml-6 border-l border-border py-2">
                {jobs.map((j) => (
                  <li key={j.id} className="relative py-2 pl-5 pr-4">
                    <span className={`absolute -left-[7px] top-4 size-3 rounded-full ring-4 ring-surface ${jobStage(j) >= 2 ? "bg-success" : "bg-brand"}`} aria-hidden />
                    <Link href={`${base}/work/${j.id}`} className="block rounded-lg p-2 transition hover:bg-surface-2">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-navy">{j.complaint}</span>
                        <Badge tone={jobStage(j) >= 2 ? "green" : "blue"}>{JOB_STAGES[jobStage(j)]}</Badge>
                      </span>
                      <span className="block text-xs text-muted">
                        {dayFormat.format(j.completedAt ?? j.openedAt)} · {j.number} · {COMPANIES[j.company].name}
                        {j.lines.length > 0 && ` · ${j.lines.length} item${j.lines.length === 1 ? "" : "s"}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Invoices for this boat" icon={Receipt}>
            {invoices.length === 0 ? (
              <Empty>No invoice linked to this boat.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {invoices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      <span className="block font-medium text-navy">{i.number}</span>
                      <span className="block text-xs text-muted">{dayFormat.format(i.invoiceDate)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular">{formatMoney(i.totalTTC)}</span>
                      {i.balance > 0 ? <Badge tone={i.dueDate.toISOString().slice(0, 10) < today ? "red" : "amber"}>{formatMoney(i.balance)} due</Badge> : <Badge tone="green">Paid</Badge>}
                      <a href={`${base}/invoices/${i.id}/pdf`} target="_blank" rel="noopener" className="text-xs font-medium text-brand hover:underline">
                        PDF
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Engines & hours" icon={Gauge}>
            {boat.engines.length === 0 ? (
              <Empty>No engine recorded yet.</Empty>
            ) : (
              <div className="p-4">
                <EngineHoursForm
                  token={token}
                  vesselId={boat.id}
                  engines={boat.engines.map((e) => ({
                    id: e.id,
                    label: [e.position, e.make, e.model].filter(Boolean).join(" "),
                    serial: e.serialNumber,
                    hours: e.hours,
                    updated: e.hoursAt ? `${dayFormat.format(e.hoursAt)}${e.hoursBy ? ` by ${e.hoursBy === "Customer" ? "you" : e.hoursBy}` : ""}` : null,
                  }))}
                />
              </div>
            )}
          </Card>

          <Card title="Warranties" icon={ShieldCheck}>
            {warranties.length === 0 ? (
              <Empty>No active warranty on this boat.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {warranties.map((w) => (
                  <li key={w.id}>
                    <RowLink href={`${base}/warranties#${w.id}`}>
                      <span className="text-sm font-medium text-navy">{w.item}</span>
                      <span className="text-xs text-muted">until {dayFormat.format(w.endDate)}</span>
                    </RowLink>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Appointments" icon={CalendarDays}>
            {appointments.length === 0 ? (
              <Empty>None yet.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium text-navy">
                        {dayFormat.format(a.date)} · {a.time}
                      </span>
                      <span className="block truncate text-xs text-muted">{a.reason}</span>
                    </span>
                    <span className="text-xs text-muted">{APPOINTMENT_STATUS[a.status as keyof typeof APPOINTMENT_STATUS]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {facts.length > 0 && (
            <Card title="Boat details">
              <dl className="grid grid-cols-2 gap-3 p-4 text-sm">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="font-medium text-navy">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export default function PortalBoat({ params }: PageProps<"/p/[token]/boats/[vesselId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Boat params={params} />
    </Suspense>
  );
}
