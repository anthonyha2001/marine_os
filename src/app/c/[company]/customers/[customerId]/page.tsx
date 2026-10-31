import { Suspense } from "react";
import Link from "next/link";
import { payHref } from "@/lib/url";
import { notFound } from "next/navigation";
import { CalendarDays, FileText, Hammer, HandCoins, Pencil, Receipt, Sailboat, ScrollText } from "lucide-react";
import { NewAppointmentDialog, NewJobCardDialog, NewOfferDialog, NewVesselDialog } from "@/components/create-dialogs";
import { requireModule } from "@/lib/auth";
import { listAppointments } from "@/lib/data/appointments";
import { APPOINTMENT_STATUS } from "@/lib/data/portal";
import { invoicesWithBalance, listReceipts } from "@/lib/data/ledger";
import { listCustomers, listOffers } from "@/lib/data/sales";
import { listVessels } from "@/lib/data/vessels";
import { JOB_STATUS, listJobCards } from "@/lib/data/workshop";
import { dayFormat } from "@/lib/dates";
import { formatMoney, round2 } from "@/lib/money";
import { OFFER_STATUSES } from "@/lib/offers";
import { COMPANIES, canAccessModule } from "@/lib/permissions";
import { PortalLinkButton } from "@/components/share-link";
import { SendButton } from "@/components/send-button";
import { Modal } from "@/components/modal";
import { InvoiceDialog, OfferDialog } from "@/components/document-dialogs";
import { JobCardDialog } from "@/components/job-dialogs";
import { Badge, ButtonLink, PageHeader, StatCard, cardClass, secondaryButton, type Tone } from "@/components/ui";
import { CustomerForm } from "../customer-form";

const OFFER_TONE: Record<string, Tone> = { DRAFT: "gray", SENT: "blue", ACCEPTED: "green", REJECTED: "red" };
const JOB_TONE: Record<string, Tone> = { OPEN: "blue", IN_PROGRESS: "amber", DONE: "green", CANCELLED: "gray" };
const AP_TONE: Record<string, Tone> = { REQUESTED: "amber", CONFIRMED: "blue", DONE: "green", DECLINED: "gray", CANCELLED: "gray" };

/** One list on the customer page: a title, a "+ new" link, rows, and a link to everything. */
function Panel({
  title,
  icon: Icon,
  count,
  newHref,
  newLabel,
  allHref,
  children,
}: {
  title: string;
  icon: typeof FileText;
  count: number;
  newHref?: string;
  newLabel?: string;
  allHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${cardClass} flex flex-col`}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Icon className="size-4 text-brand" aria-hidden /> {title}
          <span className="font-normal text-muted">{count}</span>
        </h2>
        {newHref && (
          <Link href={newHref} className="text-xs font-medium text-brand hover:underline">
            + {newLabel}
          </Link>
        )}
      </header>
      {count === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">None yet.</p> : <ul className="divide-y divide-border">{children}</ul>}
      {allHref && count > 5 && (
        <Link href={allHref} className="mt-auto border-t border-border px-4 py-2 text-center text-xs font-medium text-brand hover:underline">
          See all {count}
        </Link>
      )}
    </section>
  );
}

function Row({ href, title, detail, right }: { href: string; title: string; detail: string; right: React.ReactNode }) {
  return (
    <li>
      <Link href={href} scroll={false} data-nav-row className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-navy">{title}</span>
          <span className="block truncate text-xs text-muted">{detail}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-right text-sm">{right}</span>
      </Link>
    </li>
  );
}

type Search = { edit?: string; inv?: string; offer?: string; job?: string; invoice?: string; create?: string };

async function CustomerContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; customerId: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ company, customerId }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "customers");
  const may = {
    offers: canAccessModule(user, slug, "offers"),
    invoices: canAccessModule(user, slug, "invoices"),
    workshop: canAccessModule(user, slug, "workshop"),
    accounting: canAccessModule(user, slug, "accounting"),
  };
  const [customers, vessels, offers, invoices, receipts, jobs, appointments] = await Promise.all([
    listCustomers(),
    listVessels(),
    may.offers ? listOffers(slug) : [],
    may.invoices ? invoicesWithBalance(slug) : [],
    may.invoices ? listReceipts(slug) : [],
    may.workshop ? listJobCards(slug) : [],
    may.workshop ? listAppointments(slug) : [],
  ]);
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) notFound();

  // Documents point at the customer by id; older ones typed by name only are matched by name.
  const name = customer.name.trim().toLowerCase();
  const mine = (d: { customerId: string | null; customerName: string }) =>
    d.customerId === customer.id || (!d.customerId && d.customerName.trim().toLowerCase() === name);

  const c = `/c/${slug}`;
  const base = `${c}/customers/${customer.id}`;
  const today = new Date().toISOString().slice(0, 10);
  const boats = vessels.filter((v) => v.customer?.id === customer.id);
  const myOffers = offers.filter(mine);
  const myInvoices = invoices.filter(mine);
  const myReceipts = receipts.filter(mine).filter((r) => r.status !== "CANCELLED");
  const myJobs = jobs.filter(mine);
  const myAppointments = appointments.filter(mine);
  const upcoming = myAppointments.filter((a) => a.date.toISOString().slice(0, 10) >= today && (a.status === "REQUESTED" || a.status === "CONFIRMED"));

  const due = round2(myInvoices.reduce((s, i) => s + i.balance, 0));
  const overdue = round2(myInvoices.filter((i) => i.balance > 0 && i.dueDate.toISOString().slice(0, 10) < today).reduce((s, i) => s + i.balance, 0));
  const year = today.slice(0, 4);
  const salesThisYear = round2(myInvoices.filter((i) => i.invoiceDate.toISOString().startsWith(year)).reduce((s, i) => s + i.totalTTC, 0));
  const openOffers = myOffers.filter((o) => o.status === "DRAFT" || o.status === "SENT");
  const openJobs = myJobs.filter((j) => j.status === "OPEN" || j.status === "IN_PROGRESS");
  const day = (d: Date) => dayFormat.format(d);
  const top = <T,>(rows: T[]) => rows.slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow={`Customer · ${COMPANIES[slug].name}`}
        title={customer.name}
        description={[customer.contactName, customer.phone, customer.email, customer.address].filter(Boolean).join(" · ") || "No contact details yet."}
        action={
          <>
            {may.offers && <ButtonLink icon={FileText} href={`${base}?create=offer`}>New offer</ButtonLink>}
            {may.workshop && (
              <Link href={`${base}?create=job`} className={secondaryButton}>
                <Hammer className="size-4" aria-hidden /> Job card
              </Link>
            )}
            {may.accounting && (
              <Link href={payHref(base, "CUSTOMER", { customer: customer.id })} scroll={false} className={secondaryButton}>
                <HandCoins className="size-4" aria-hidden /> Receive payment
              </Link>
            )}
            <Link href={`${base}?edit=1`} scroll={false} className={secondaryButton}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Link>
          </>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-1 text-muted">
          Customer portal: <PortalLinkButton companySlug={slug} customerId={customer.id} hasLink={!!customer.portalToken} token={customer.portalToken} />
        </span>
        <SendButton companySlug={slug} kind="portal" id={customer.id} label="Send portal link" />
        {may.accounting && (
          <Link href={`${c}/finance/statements?type=customer&party=${customer.id}`} className="flex items-center gap-1 text-brand hover:underline">
            <ScrollText className="size-4" aria-hidden /> Statement of account
          </Link>
        )}
        {customer.taxNumber && <span className="text-muted">VAT no. {customer.taxNumber}</span>}
      </div>
      {customer.notes && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-slate-700">{customer.notes}</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {may.invoices && <StatCard label="Owes us" value={formatMoney(due)} hint={overdue > 0 ? `${formatMoney(overdue)} overdue` : "nothing overdue"} tone={overdue > 0 ? "danger" : "default"} />}
        {may.invoices && <StatCard label={`Sales ${year}`} value={formatMoney(salesThisYear)} hint={`${myInvoices.length} invoice${myInvoices.length === 1 ? "" : "s"} in all`} />}
        {may.offers && <StatCard label="Open offers" value={String(openOffers.length)} hint={formatMoney(openOffers.reduce((s, o) => s + o.totalTTC, 0))} />}
        {may.workshop && <StatCard label="Jobs in progress" value={String(openJobs.length)} hint={`${upcoming.length} upcoming appointment${upcoming.length === 1 ? "" : "s"}`} />}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {may.invoices && (
          <Panel title="Invoices" icon={Receipt} count={myInvoices.length} allHref={`${c}/invoices?q=${encodeURIComponent(customer.name)}`}>
            {top(myInvoices).map((i) => (
              <Row
                key={i.id}
                href={`${base}?inv=${i.id}`}
                title={i.number}
                detail={`${day(i.invoiceDate)} · due ${day(i.dueDate)}`}
                right={
                  <>
                    <span className="tabular font-medium text-navy">{formatMoney(i.totalTTC)}</span>
                    {i.balance > 0 ? (
                      <Badge tone={i.dueDate.toISOString().slice(0, 10) < today ? "red" : "amber"}>{formatMoney(i.balance)} due</Badge>
                    ) : (
                      <Badge tone="green">Paid</Badge>
                    )}
                  </>
                }
              />
            ))}
          </Panel>
        )}

        {may.offers && (
          <Panel title="Offers" icon={FileText} count={myOffers.length} newHref={`${base}?create=offer`} newLabel="New offer">
            {top(myOffers).map((o) => (
              <Row
                key={o.id}
                href={`${base}?offer=${o.id}`}
                title={o.number}
                detail={`${day(o.offerDate)}${o.subject ? ` · ${o.subject}` : ""}`}
                right={
                  <>
                    <span className="tabular font-medium text-navy">{formatMoney(o.totalTTC)}</span>
                    <Badge tone={OFFER_TONE[o.status] ?? "gray"}>{OFFER_STATUSES[o.status]}</Badge>
                  </>
                }
              />
            ))}
          </Panel>
        )}

        <Panel title="Boats" icon={Sailboat} count={boats.length} newHref={`${base}?create=boat`} newLabel="Add boat">
          {boats.map((v) => (
            <Row
              key={v.id}
              href={`${c}/vessels/${v.id}`}
              title={v.name}
              detail={[v.make, v.model, v.registration, v.homePort].filter(Boolean).join(" · ") || "No details"}
              right={<span className="text-xs text-muted">{v.engines.length} engine{v.engines.length === 1 ? "" : "s"}</span>}
            />
          ))}
        </Panel>

        {may.workshop && (
          <Panel title="Job cards" icon={Hammer} count={myJobs.length} newHref={`${base}?create=job`} newLabel="New job card">
            {top(myJobs).map((j) => (
              <Row
                key={j.id}
                href={`${base}?job=${j.id}`}
                title={j.number}
                detail={`${day(j.openedAt)}${j.vessel ? ` · ${j.vessel.name}` : ""}${j.complaint ? ` · ${j.complaint}` : ""}`}
                right={<Badge tone={JOB_TONE[j.status] ?? "gray"}>{JOB_STATUS[j.status]}</Badge>}
              />
            ))}
          </Panel>
        )}

        {may.workshop && (
          <Panel title="Appointments" icon={CalendarDays} count={myAppointments.length} newHref={`${base}?create=booking`} newLabel="Book">
            {top([...myAppointments].reverse()).map((a) => (
              <Row
                key={a.id}
                href={`${c}/appointments?date=${a.date.toISOString().slice(0, 10)}`}
                title={`${day(a.date)}${a.time ? ` · ${a.time}` : ""}`}
                detail={[a.number, a.vessel?.name, a.reason].filter(Boolean).join(" · ")}
                right={<Badge tone={AP_TONE[a.status] ?? "gray"}>{APPOINTMENT_STATUS[a.status]}</Badge>}
              />
            ))}
          </Panel>
        )}

        {may.invoices && (
          <Panel title="Payments received" icon={HandCoins} count={myReceipts.length} allHref={`${c}/finance/receipts?q=${encodeURIComponent(customer.name)}`}>
            {top(myReceipts).map((r) => (
              <Row
                key={r.id}
                href={r.invoice ? `${c}/invoices/${r.invoice.id}` : `${c}/finance/receipts?q=${encodeURIComponent(r.number)}`}
                title={r.number}
                detail={`${day(r.receivedAt)} · ${r.method}${r.invoice ? ` · ${r.invoice.number}` : ""}`}
                right={<span className="tabular font-medium text-success">{formatMoney(r.amount)}</span>}
              />
            ))}
          </Panel>
        )}
      </div>

      {search.inv && may.invoices && <InvoiceDialog slug={slug} id={search.inv} closeHref={base} canReceive={may.accounting} canOpen />}
      {search.offer && may.offers && <OfferDialog slug={slug} id={search.offer} closeHref={base} canInvoice={may.invoices} />}
      {search.job && may.workshop && (
        <JobCardDialog slug={slug} id={search.job} closeHref={base} selfHref={`${base}?job=${search.job}`} canInvoice={may.invoices} invoicing={search.invoice === "1"} />
      )}
      {search.create === "offer" && may.offers && <NewOfferDialog slug={slug} closeHref={base} customerId={customer.id} />}
      {search.create === "job" && may.workshop && <NewJobCardDialog slug={slug} closeHref={base} customerId={customer.id} />}
      {search.create === "boat" && <NewVesselDialog slug={slug} closeHref={base} customerId={customer.id} />}
      {search.create === "booking" && may.workshop && <NewAppointmentDialog slug={slug} closeHref={base} customerId={customer.id} />}
      {search.edit && (
        <Modal title={`Edit ${customer.name}`} closeHref={base} size="md">
          <div className={`${cardClass} p-5`}>
            <CustomerForm companySlug={slug} customer={customer} />
          </div>
        </Modal>
      )}
    </>
  );
}

export default function CustomerPage({ params, searchParams }: PageProps<"/c/[company]/customers/[customerId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CustomerContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
