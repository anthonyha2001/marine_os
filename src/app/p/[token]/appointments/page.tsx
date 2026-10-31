import { Suspense } from "react";
import { CalendarDays, CalendarPlus } from "lucide-react";
import { businessToday, dayFormat } from "@/lib/dates";
import { APPOINTMENT_SLOTS, APPOINTMENT_STATUS, portalAppointments, portalCustomer } from "@/lib/data/portal";
import { COMPANIES } from "@/lib/permissions";
import { Badge } from "@/components/ui";
import { Card, Empty, PageHead } from "../_parts";
import { BookingForm, CancelMine } from "../portal-forms";

const TONE = { REQUESTED: "amber", CONFIRMED: "green", DONE: "gray", DECLINED: "red", CANCELLED: "gray" } as const;
const STATUS_TEXT = { ...APPOINTMENT_STATUS, REQUESTED: "Waiting for confirmation" } as const;

async function Appointments({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ booked?: string; cancelled?: string; boat?: string }> }) {
  const [{ token }, search] = await Promise.all([params, searchParams]);
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const { appointments, vessels } = await portalAppointments(customer.id);
  const today = businessToday();
  const tomorrow = new Date(new Date(`${today}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
  const upcoming = appointments.filter((a) => (a.date.toISOString().slice(0, 10) >= today && (a.status === "REQUESTED" || a.status === "CONFIRMED")) || a.status === "REQUESTED").reverse();
  const past = appointments.filter((a) => !upcoming.includes(a));

  return (
    <>
      <PageHead title="Appointments" sub="Book a visit to the workshop or the shop. We confirm it here (or suggest another time)." />
      {search.booked && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-success">Request sent. We&apos;ll confirm it here shortly.</p>}
      {search.cancelled && <p role="status" className="mb-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-navy">Appointment cancelled.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card title="Coming up" icon={CalendarDays}>
            {upcoming.length === 0 ? (
              <Empty>Nothing booked.</Empty>
            ) : (
              <ul className="divide-y divide-border">
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
                    <CancelMine token={token} appointmentId={a.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {past.length > 0 && (
            <Card title="Past and cancelled">
              <ul className="divide-y divide-border">
                {past.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>
                      <span className="text-navy">{dayFormat.format(a.date)}</span>
                      <span className="block truncate text-xs text-muted">{a.reason}</span>
                    </span>
                    <span className="text-xs text-muted">{STATUS_TEXT[a.status]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div id="book" className="scroll-mt-20">
          <Card title="Book an appointment" icon={CalendarPlus}>
            <div className="p-4">
              <BookingForm
                token={token}
                slots={APPOINTMENT_SLOTS}
                minDate={tomorrow}
                defaultVesselId={search.boat}
                companies={[
                  { slug: "xpert-marine", name: COMPANIES["xpert-marine"].name, what: COMPANIES["xpert-marine"].tagline },
                  { slug: "eliche-radice", name: COMPANIES["eliche-radice"].name, what: COMPANIES["eliche-radice"].tagline },
                ]}
                vessels={vessels}
              />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function PortalAppointments({ params, searchParams }: PageProps<"/p/[token]/appointments">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Appointments params={params} searchParams={searchParams as Promise<{ booked?: string; cancelled?: string; boat?: string }>} />
    </Suspense>
  );
}
