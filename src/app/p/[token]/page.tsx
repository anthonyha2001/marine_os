import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, FileText, Hammer, MessageCircle, Receipt, Sailboat, Wallet } from "lucide-react";
import { businessToday, dayFormat } from "@/lib/dates";
import { APPOINTMENT_STATUS, JOB_STAGES, jobStage, portalCustomer, portalHome } from "@/lib/data/portal";
import { formatMoney, round2 } from "@/lib/money";
import { COMPANIES } from "@/lib/permissions";
import { Badge, cardClass, primaryButton, secondaryButton } from "@/components/ui";
import { Card, CompanyTag, Empty, JobTrack, RowLink } from "./_parts";

async function Home({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const [{ token }, search] = await Promise.all([params, searchParams]);
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const data = await portalHome(customer.id);
  const base = `/p/${token}`;
  const today = businessToday();
  const open = data.invoices.filter((i) => i.balance > 0);
  const due = round2(open.reduce((s, i) => s + i.balance, 0));
  const overdue = round2(open.filter((i) => i.dueDate.toISOString().slice(0, 10) < today).reduce((s, i) => s + i.balance, 0));
  const offers = data.offers.filter((o) => o.validUntil.toISOString().slice(0, 10) >= today);
  const next = data.appointments.find((a) => a.date.toISOString().slice(0, 10) >= today);
  const active = data.jobs.filter((j) => jobStage(j) < 3).slice(0, 4);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Beirut" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const tiles = [
    { label: "To pay", value: formatMoney(due), hint: overdue > 0 ? `${formatMoney(overdue)} overdue` : open.length ? `${open.length} invoice${open.length === 1 ? "" : "s"}` : "All paid", href: `${base}/invoices`, icon: Wallet, alert: overdue > 0 },
    { label: "Work in progress", value: String(active.length), hint: active.length ? JOB_STAGES[jobStage(active[0])] : "Nothing running", href: `${base}/work`, icon: Hammer },
    { label: "Next appointment", value: next ? dayFormat.format(next.date) : "—", hint: next ? `${next.time} · ${APPOINTMENT_STATUS[next.status]}` : "None booked", href: `${base}/appointments`, icon: CalendarDays },
    { label: "Messages", value: String(data.unreadThreads), hint: data.unreadThreads ? "new answers" : "No new answers", href: `${base}/messages`, icon: MessageCircle, alert: data.unreadThreads > 0 },
  ];

  return (
    <div className="space-y-6">
      {search.welcome && (
        <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-success">
          Welcome! Your account is ready. <strong>Bookmark this page or install the app</strong>: this private link is your key, so keep it to yourself.
        </p>
      )}
      <div className="rounded-2xl bg-navy px-5 py-6 text-white sm:px-7">
        <p className="text-sm text-white/70">{greeting},</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{customer.contactName || customer.name}</h1>
        <p className="mt-1 text-sm text-white/70">Everything about your boats with {COMPANIES["xpert-marine"].name} and {COMPANIES["eliche-radice"].name}, in one place.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`${base}/appointments#book`} className={`${primaryButton} bg-white text-navy hover:bg-white/90`}>
            <CalendarDays className="size-4" aria-hidden /> Book a service
          </Link>
          <Link href={`${base}/messages/new?topic=QUOTE`} className={`${secondaryButton} border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white`}>
            <FileText className="size-4" aria-hidden /> Ask for a quote
          </Link>
          <Link href={`${base}/messages/new`} className={`${secondaryButton} border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white`}>
            <MessageCircle className="size-4" aria-hidden /> Ask a question
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={`${cardClass} block p-4 transition hover:border-brand/40 hover:shadow-md`}>
            <span className="flex items-center justify-between text-[13px] font-medium text-muted">
              {t.label} <t.icon className="size-4 text-brand" aria-hidden />
            </span>
            <span className={`tabular mt-1.5 block text-xl font-semibold ${t.alert ? "text-danger" : "text-navy"}`}>{t.value}</span>
            <span className={`block text-xs ${t.alert ? "font-medium text-danger" : "text-muted"}`}>{t.hint}</span>
          </Link>
        ))}
      </div>

      {offers.length > 0 && (
        <Card title="Offers waiting for your answer" icon={FileText}>
          <ul className="divide-y divide-border">
            {offers.map((o) => (
              <li key={o.id}>
                <RowLink href={`${base}/offers/${o.id}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-navy">{o.subject ?? `Offer ${o.number}`}</span>
                    <span className="block text-xs text-muted">
                      {o.number} · {COMPANIES[o.company].name} · valid until {dayFormat.format(o.validUntil)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tabular font-semibold text-navy">{formatMoney(o.totalTTC)}</span>
                    <Badge tone="blue">Answer</Badge>
                  </span>
                </RowLink>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Work on your boats" icon={Hammer} action={<Link href={`${base}/work`} className="text-xs font-medium text-brand hover:underline">See all</Link>}>
          {active.length === 0 ? (
            <Empty>No work in progress right now.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {active.map((j) => (
                <li key={j.id}>
                  <Link href={`${base}/work/${j.id}`} className="block space-y-3 px-4 py-3 transition hover:bg-surface-2">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-navy">{j.vessel?.name ?? j.complaint}</span>
                        <span className="block truncate text-xs text-muted">{j.vessel ? j.complaint : j.number}</span>
                      </span>
                      <CompanyTag slug={j.company} />
                    </span>
                    <JobTrack stage={jobStage(j)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Invoices to pay" icon={Receipt} action={<Link href={`${base}/invoices`} className="text-xs font-medium text-brand hover:underline">See all</Link>}>
          {open.length === 0 ? (
            <Empty>Nothing to pay. Thank you!</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {open.slice(0, 5).map((i) => {
                const late = i.dueDate.toISOString().slice(0, 10) < today;
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      <span className="block font-medium text-navy">{i.number}</span>
                      <span className="block text-xs text-muted">
                        {COMPANIES[i.company].name} · due {dayFormat.format(i.dueDate)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={late ? "red" : "amber"}>{formatMoney(i.balance)}</Badge>
                      <a href={`${base}/invoices/${i.id}/pdf`} target="_blank" rel="noopener" className="text-xs font-medium text-brand hover:underline">
                        PDF
                      </a>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {data.vessels > 0 && (
        <Link href={`${base}/boats`} className={`${cardClass} flex items-center justify-between gap-3 p-4 transition hover:border-brand/40`}>
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Sailboat className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-medium text-navy">
                {data.vessels} boat{data.vessels === 1 ? "" : "s"} on your account
              </span>
              <span className="block text-xs text-muted">Service history, engines and hours, warranties</span>
            </span>
          </span>
          <span className="text-sm font-medium text-brand">Open →</span>
        </Link>
      )}
    </div>
  );
}

export default function PortalHome({ params, searchParams }: PageProps<"/p/[token]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Home params={params} searchParams={searchParams as Promise<{ welcome?: string }>} />
    </Suspense>
  );
}
