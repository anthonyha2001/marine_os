import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Hammer, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { appointmentToJobCard } from "@/lib/actions/appointments";
import { businessToday } from "@/lib/dates";
import { listAppointments, type AppointmentRow } from "@/lib/data/appointments";
import { APPOINTMENT_SLOTS, APPOINTMENT_STATUS } from "@/lib/data/portal";
import { listCustomers } from "@/lib/data/sales";
import { vesselOptions } from "@/lib/data/vessels";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { Badge, ButtonLink, EmptyState, PageHeader, cardClass, secondaryButton, secondaryButtonSm } from "@/components/ui";
import { AppointmentActions, ConfirmForm, NewAppointmentForm } from "./appointment-forms";

type Search = { date?: string; new?: string; confirm?: string };
const TONE = { REQUESTED: "amber", CONFIRMED: "blue", DONE: "green", DECLINED: "gray", CANCELLED: "gray" } as const;
const dayHead = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const short = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

function Row({ a, slug, showDate = false }: { a: AppointmentRow; slug: string; showDate?: boolean }) {
  const base = `/c/${slug}/appointments`;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {showDate && <span className="text-xs font-medium uppercase tracking-wider text-muted">{dayHead.format(a.date)}</span>}
          <span className="tabular font-semibold text-navy">{a.time}</span>
          <span className="font-medium text-navy">{a.customerName}</span>
          {a.vessel && <span className="text-muted">· {a.vessel.name}</span>}
          <Badge tone={TONE[a.status]}>{APPOINTMENT_STATUS[a.status]}</Badge>
          {a.source === "PORTAL" && <span className="text-xs text-muted">online</span>}
        </p>
        <p className="mt-0.5 text-sm text-slate-700">{a.reason}</p>
        <p className="text-xs text-muted">
          {a.number}
          {a.phone && ` · ${a.phone}`}
          {a.status === "CONFIRMED" && (iso(a.date) !== iso(a.requestedDate) || a.time !== a.requestedTime) && ` · asked for ${short.format(a.requestedDate)} ${a.requestedTime}`}
          {a.staffNote && ` · ${a.staffNote}`}
          {a.customerNote && ` · ${a.customerNote}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {(a.status === "REQUESTED" || a.status === "CONFIRMED") && (
          <Link href={`${base}?date=${iso(a.date)}&confirm=${a.id}`} scroll={false} className={secondaryButtonSm}>
            {a.status === "REQUESTED" ? "Confirm" : "Move"}
          </Link>
        )}
        {a.jobCard ? (
          <Link href={`/c/${slug}/workshop/${a.jobCard.id}`} className="font-mono text-xs text-brand hover:underline">
            {a.jobCard.number}
          </Link>
        ) : (
          a.status === "CONFIRMED" && (
            <form action={appointmentToJobCard.bind(null, slug, a.id)}>
              <button type="submit" className={secondaryButtonSm}>
                <Hammer className="size-3.5" aria-hidden /> Job card
              </button>
            </form>
          )
        )}
        <AppointmentActions companySlug={slug} appointmentId={a.id} status={a.status} label={a.number} />
      </div>
    </li>
  );
}

async function AppointmentsContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "workshop");
  const base = `/c/${slug}/appointments`;
  const today = businessToday();
  const anchor = new Date(`${search.date && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : today}T00:00:00Z`);
  const monday = addDays(anchor, -((anchor.getUTCDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const all = await listAppointments(slug);
  const requests = all.filter((a) => a.status === "REQUESTED").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const week = all.filter((a) => iso(a.date) >= iso(days[0]) && iso(a.date) <= iso(days[6]) && a.status !== "REQUESTED");
  const confirming = search.confirm ? all.find((a) => a.id === search.confirm) : undefined;
  const [customers, vessels] = search.new ? await Promise.all([listCustomers(), vesselOptions()]) : [[], []];

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Workshop`}
        title="Appointments"
        description="Bookings from the customer portal and by phone. Confirm requests (or move them), and open a job card when the boat arrives."
        action={<ButtonLink icon={Plus} href={`${base}?date=${iso(anchor)}&new=1`}>New appointment</ButtonLink>}
      />

      {requests.length > 0 && (
        <section className={`${cardClass} mt-6 overflow-hidden border-amber-200`}>
          <h2 className="border-b border-border bg-amber-50 px-4 py-3 font-semibold text-amber-900">
            {requests.length} request{requests.length === 1 ? "" : "s"} to confirm
          </h2>
          <ul className="divide-y divide-border">
            {requests.map((a) => (
              <Row key={a.id} a={a} slug={slug} showDate />
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy">
          Week of {short.format(days[0])} – {short.format(days[6])}
        </h2>
        <div className="flex gap-2">
          <Link href={`${base}?date=${iso(addDays(monday, -7))}`} className={secondaryButton} aria-label="Previous week">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href={base} className={secondaryButton}>
            This week
          </Link>
          <Link href={`${base}?date=${iso(addDays(monday, 7))}`} className={secondaryButton} aria-label="Next week">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {week.length === 0 ? (
          <div className={cardClass}>
            <EmptyState icon={CalendarDays} title="No appointments this week" />
          </div>
        ) : (
          days.map((d) => {
            const items = week.filter((a) => iso(a.date) === iso(d));
            if (!items.length) return null;
            return (
              <section key={iso(d)} className={`${cardClass} overflow-hidden`}>
                <h3 className={`border-b border-border px-4 py-2.5 text-sm font-semibold ${iso(d) === today ? "bg-brand-soft text-brand" : "text-navy"}`}>
                  {dayHead.format(d)}
                  {iso(d) === today && " · today"}
                </h3>
                <ul className="divide-y divide-border">
                  {items.map((a) => (
                    <Row key={a.id} a={a} slug={slug} />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {search.new && (
        <Modal title="New appointment" closeHref={`${base}?date=${iso(anchor)}`} size="lg">
          <NewAppointmentForm key={crypto.randomUUID()} companySlug={slug} slots={APPOINTMENT_SLOTS} date={iso(anchor) < today ? today : iso(anchor)} customers={customers.map((c) => ({ id: c.id, name: c.name }))} vessels={vessels} />
        </Modal>
      )}
      {confirming && (
        <Modal title={`${confirming.status === "REQUESTED" ? "Confirm" : "Move"} ${confirming.number} · ${confirming.customerName}`} closeHref={`${base}?date=${iso(anchor)}`} size="md">
          <p className="mb-4 text-sm text-muted">
            {confirming.reason}
            {confirming.vessel && ` · ${confirming.vessel.name}`} · asked for {short.format(confirming.requestedDate)} at {confirming.requestedTime}
          </p>
          <ConfirmForm key={crypto.randomUUID()} companySlug={slug} appointmentId={confirming.id} slots={APPOINTMENT_SLOTS} date={iso(confirming.date)} time={confirming.time} />
        </Modal>
      )}
    </>
  );
}

export default function AppointmentsPage({ params, searchParams }: PageProps<"/c/[company]/appointments">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading appointments…</p>}>
      <AppointmentsContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
