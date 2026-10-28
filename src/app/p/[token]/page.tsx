import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, FileText, Sailboat } from "lucide-react";
import { businessToday, dayFormat } from "@/lib/dates";
import { APPOINTMENT_SLOTS, APPOINTMENT_STATUS, portalCustomer, portalData } from "@/lib/data/portal";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Badge, cardClass, secondaryButtonSm } from "@/components/ui";
import { BookingForm, CancelMine } from "./portal-forms";

const TONE = { REQUESTED: "amber", CONFIRMED: "green", DONE: "gray", DECLINED: "red", CANCELLED: "gray" } as const;
const STATUS_TEXT = { ...APPOINTMENT_STATUS, REQUESTED: "Waiting for confirmation" } as const;

function Section({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <section className={`${cardClass} overflow-hidden`}>
      <h2 className="flex items-center gap-2 border-b border-border px-5 py-3 font-semibold text-navy">
        <Icon className="size-4 text-brand" aria-hidden /> {title}
      </h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

async function Portal({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ booked?: string; cancelled?: string }> }) {
  const [{ token }, search] = await Promise.all([params, searchParams]);
  const customer = await portalCustomer(token);
  if (!customer) return <p className="text-muted">This link is no longer valid. Please contact us for a new one.</p>;
  const data = await portalData(customer.id);
  const today = businessToday();
  const tomorrow = new Date(new Date(`${today}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
  const awaiting = data.offers.filter((o) => o.status === "SENT" && o.validUntil.toISOString().slice(0, 10) >= today);
  const openInvoices = data.invoices.filter((i) => i.balance > 0);
  const upcoming = data.appointments.filter((a) => a.date.toISOString().slice(0, 10) >= today || a.status === "REQUESTED");
  const due = round2(openInvoices.reduce((s, i) => s + i.balance, 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Hello, {customer.name}</h1>
        <p className="mt-1 text-sm text-muted">Your boats, appointments, offers and invoices with Xpert Marine and Eliche Radice.</p>
      </div>
      {search.booked && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-success">
          Request sent. We&apos;ll confirm the appointment here shortly.
        </p>
      )}
      {search.cancelled && (
        <p role="status" className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-navy">
          Appointment cancelled.
        </p>
      )}

      {awaiting.length > 0 && (
        <Section title="Offers waiting for your answer" icon={FileText}>
          <ul className="divide-y divide-border">
            {awaiting.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span>
                  <span className="font-mono text-xs text-muted">{o.number}</span> <span className="font-medium text-navy">{o.subject ?? "Offer"}</span>
                  <span className="block text-xs text-muted">
                    {COMPANIES[o.company].name} · valid until {dayFormat.format(o.validUntil)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular font-semibold">{formatMoney(o.totalTTC)}</span>
                  <Link href={`/p/${token}/offers/${o.id}`} className={secondaryButtonSm}>
                    View & answer
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Appointments" icon={CalendarDays}>
        {upcoming.length > 0 && (
          <ul className="mb-5 divide-y divide-border rounded-lg border border-border">
            {upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold text-navy">
                    {dayFormat.format(a.date)} at {a.time}
                  </span>{" "}
                  <Badge tone={TONE[a.status]}>{STATUS_TEXT[a.status]}</Badge>
                  <span className="block text-muted">
                    {a.reason}
                    {a.vessel && ` · ${a.vessel.name}`} · {COMPANIES[a.company].name}
                  </span>
                </span>
                {(a.status === "REQUESTED" || a.status === "CONFIRMED") && <CancelMine token={token} appointmentId={a.id} />}
              </li>
            ))}
          </ul>
        )}
        <h3 className="mb-3 text-sm font-semibold text-navy">Book an appointment</h3>
        <BookingForm
          token={token}
          slots={APPOINTMENT_SLOTS}
          minDate={tomorrow}
          companies={[
            { slug: "xpert-marine", name: COMPANIES["xpert-marine"].name, what: COMPANIES["xpert-marine"].tagline },
            { slug: "eliche-radice", name: COMPANIES["eliche-radice"].name, what: COMPANIES["eliche-radice"].tagline },
          ]}
          vessels={data.vessels.map((v) => ({ id: v.id, name: v.name }))}
        />
      </Section>

      <Section title={`Invoices${due > 0 ? ` · ${formatMoney(due)} to pay` : ""}`} icon={FileText}>
        {data.invoices.length === 0 ? (
          <p className="text-sm text-muted">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.invoices.slice(0, 30).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="font-mono text-xs text-muted">{i.number}</span> {dayFormat.format(i.invoiceDate)}
                  <span className="block text-xs text-muted">{COMPANIES[i.company].name}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular">{formatMoney(i.totalTTC)}</span>
                  {i.balance > 0 ? <Badge tone={i.dueDate.toISOString().slice(0, 10) < today ? "red" : "amber"}>{formatMoney(i.balance)} due</Badge> : <Badge tone="green">Paid</Badge>}
                  <a href={`/p/${token}/invoices/${i.id}/pdf`} target="_blank" rel="noopener" className={secondaryButtonSm}>
                    PDF
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {data.vessels.length > 0 && (
        <Section title="Your boats" icon={Sailboat}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.vessels.map((v) => (
              <li key={v.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium text-navy">{v.name}</p>
                <p className="text-muted">{[v.make, v.model].filter(Boolean).join(" ") || "—"}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export default function PortalPage({ params, searchParams }: PageProps<"/p/[token]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Portal params={params} searchParams={searchParams as Promise<{ booked?: string; cancelled?: string }>} />
    </Suspense>
  );
}
