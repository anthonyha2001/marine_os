import "server-only";
import { prisma } from "@/lib/prisma";
import { invoicesWithBalance, listReceipts } from "@/lib/data/ledger";
import { COMPANY_SLUGS, COMPANIES, type CompanySlug } from "@/lib/permissions";

// What a customer sees through their private portal link. Read fresh (never cached) and only
// ever filtered by the customer the token belongs to.

export async function portalCustomer(token: string) {
  if (!token || token.length < 20) return null;
  return prisma.customer.findUnique({
    where: { portalToken: token },
    select: { id: true, name: true, contactName: true, email: true, phone: true, address: true },
  });
}
export type PortalCustomer = NonNullable<Awaited<ReturnType<typeof portalCustomer>>>;

const slugOf = (c: { slug: string }) => c.slug as CompanySlug;

/** Invoices of this customer in both companies, with what is still due. */
async function customerInvoices(customerId: string) {
  return (
    await Promise.all(
      COMPANY_SLUGS.map(async (slug) =>
        (await invoicesWithBalance(slug)).filter((i) => i.customerId === customerId).map((i) => ({ ...i, company: slug as CompanySlug })),
      ),
    )
  )
    .flat()
    .sort((a, b) => b.invoiceDate.getTime() - a.invoiceDate.getTime());
}

async function customerPayments(customerId: string) {
  return (
    await Promise.all(
      COMPANY_SLUGS.map(async (slug) =>
        (await listReceipts(slug)).filter((r) => r.customerId === customerId && r.status !== "CANCELLED").map((r) => ({ ...r, company: slug as CompanySlug })),
      ),
    )
  )
    .flat()
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
}

const jobSelect = {
  id: true,
  number: true,
  status: true,
  complaint: true,
  workDone: true,
  technician: true,
  openedAt: true,
  dueDate: true,
  completedAt: true,
  vessel: { select: { id: true, name: true } },
  offer: { select: { id: true, number: true } },
  company: { select: { slug: true } },
  lines: { orderBy: { position: "asc" as const }, select: { id: true, kind: true, title: true, quantity: true } },
  invoices: { where: { status: { not: "CANCELLED" } }, select: { id: true, number: true } },
} as const;

type JobRow = Awaited<ReturnType<typeof loadJobs>>[number];
async function loadJobs(where: { customerId: string; vesselId?: string; id?: string }) {
  const rows = await prisma.jobCard.findMany({ where: { ...where, status: { not: "CANCELLED" } }, orderBy: { openedAt: "desc" }, select: jobSelect });
  return rows.map((j) => ({ ...j, company: slugOf(j.company), lines: j.lines.map((l) => ({ ...l, quantity: Number(l.quantity) })) }));
}

/** Where a job stands, in the customer's words: Received → In progress → Ready → Invoiced. */
export function jobStage(j: Pick<JobRow, "status" | "invoices">) {
  if (j.invoices.length) return 3;
  if (j.status === "DONE") return 2;
  if (j.status === "IN_PROGRESS") return 1;
  return 0;
}
export const JOB_STAGES = ["Received", "In progress", "Ready", "Invoiced"] as const;

export async function portalHome(customerId: string) {
  const [invoices, offers, appointments, jobs, threads, vessels] = await Promise.all([
    customerInvoices(customerId),
    prisma.offer.findMany({
      where: { customerId, status: "SENT" },
      orderBy: { offerDate: "desc" },
      select: { id: true, number: true, subject: true, validUntil: true, totalTTC: true, company: { select: { slug: true } } },
    }),
    prisma.appointment.findMany({
      where: { customerId, status: { in: ["REQUESTED", "CONFIRMED"] } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
      select: { id: true, date: true, time: true, status: true, reason: true, vessel: { select: { name: true } }, company: { select: { slug: true } } },
    }),
    loadJobs({ customerId }),
    prisma.portalThread.findMany({ where: { customerId, customerUnread: true }, select: { id: true } }),
    prisma.vessel.count({ where: { customerId, active: true } }),
  ]);
  return {
    invoices,
    offers: offers.map((o) => ({ ...o, company: slugOf(o.company), totalTTC: Number(o.totalTTC) })),
    appointments: appointments.map((a) => ({ ...a, company: slugOf(a.company), status: a.status as AppointmentStatus })),
    jobs,
    unreadThreads: threads.length,
    vessels,
  };
}

export async function portalBoats(customerId: string) {
  const boats = await prisma.vessel.findMany({
    where: { customerId, active: true },
    orderBy: { name: "asc" },
    include: { engines: { orderBy: { position: "asc" } }, jobCards: { where: { status: { not: "CANCELLED" } }, orderBy: { openedAt: "desc" }, take: 1, select: { openedAt: true, completedAt: true } } },
  });
  return boats.map((b) => ({ ...b, lengthM: b.lengthM === null ? null : Number(b.lengthM), lastJob: b.jobCards[0] ?? null }));
}

/** One boat with everything done on it: jobs, invoices, warranties, appointments. */
export async function portalBoat(customerId: string, vesselId: string) {
  const boat = await prisma.vessel.findFirst({ where: { id: vesselId, customerId }, include: { engines: { orderBy: { position: "asc" } } } });
  if (!boat) return null;
  const [jobs, invoices, warranties, appointments] = await Promise.all([
    loadJobs({ customerId, vesselId }),
    customerInvoices(customerId).then((all) => all.filter((i) => i.vesselId === vesselId)),
    prisma.warranty.findMany({ where: { customerId, vesselId, status: "ACTIVE" }, orderBy: { endDate: "desc" }, select: { id: true, number: true, item: true, endDate: true } }),
    prisma.appointment.findMany({ where: { customerId, vesselId }, orderBy: { date: "desc" }, take: 10, select: { id: true, date: true, time: true, status: true, reason: true } }),
  ]);
  return { boat: { ...boat, lengthM: boat.lengthM === null ? null : Number(boat.lengthM) }, jobs, invoices, warranties, appointments };
}

export async function portalJobs(customerId: string) {
  return loadJobs({ customerId });
}

export async function portalJob(customerId: string, jobId: string) {
  return (await loadJobs({ customerId, id: jobId }))[0] ?? null;
}

export async function portalMoney(customerId: string) {
  const [invoices, payments, companies] = await Promise.all([
    customerInvoices(customerId),
    customerPayments(customerId),
    prisma.company.findMany({ select: { slug: true, legalName: true, bankDetails: true, phone: true, email: true } }),
  ]);
  return { invoices, payments, companies: companies.map((c) => ({ ...c, slug: slugOf(c), name: COMPANIES[slugOf(c)].name })) };
}

export async function portalOffers(customerId: string) {
  const offers = await prisma.offer.findMany({
    where: { customerId, status: { in: ["SENT", "ACCEPTED", "REJECTED"] } },
    orderBy: { offerDate: "desc" },
    take: 60,
    select: { id: true, number: true, subject: true, offerDate: true, validUntil: true, status: true, totalTTC: true, company: { select: { slug: true } } },
  });
  return offers.map((o) => ({ ...o, company: slugOf(o.company), totalTTC: Number(o.totalTTC) }));
}

export async function portalAppointments(customerId: string) {
  const [appointments, vessels] = await Promise.all([
    prisma.appointment.findMany({
      where: { customerId },
      orderBy: { date: "desc" },
      take: 40,
      select: { id: true, number: true, date: true, time: true, status: true, reason: true, vessel: { select: { name: true } }, company: { select: { slug: true } } },
    }),
    prisma.vessel.findMany({ where: { customerId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { appointments: appointments.map((a) => ({ ...a, status: a.status as AppointmentStatus, company: slugOf(a.company) })), vessels };
}

export async function portalWarranties(customerId: string) {
  const rows = await prisma.warranty.findMany({
    where: { customerId },
    orderBy: { endDate: "desc" },
    include: { vessel: { select: { name: true } }, company: { select: { slug: true } }, claims: { orderBy: { date: "desc" } } },
  });
  return rows.map((w) => ({ ...w, company: slugOf(w.company) }));
}

export async function portalThreads(customerId: string) {
  const rows = await prisma.portalThread.findMany({
    where: { customerId },
    orderBy: { lastMessageAt: "desc" },
    include: { company: { select: { slug: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return rows.map((t) => ({ ...t, company: slugOf(t.company), last: t.messages[0] ?? null }));
}

/** One conversation; opening it marks the company's answers as read. */
export async function portalThread(customerId: string, threadId: string) {
  const thread = await prisma.portalThread.findFirst({
    where: { id: threadId, customerId },
    include: { company: { select: { slug: true } }, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread) return null;
  if (thread.customerUnread) await prisma.portalThread.update({ where: { id: thread.id }, data: { customerUnread: false } });
  return { ...thread, company: slugOf(thread.company) };
}

/** Kept for the old single-page portal pieces (booking form, offer pages). */
export async function portalVessels(customerId: string) {
  return prisma.vessel.findMany({ where: { customerId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** An offer the customer may answer: through the shared link, or from their portal. */
export async function offerForCustomer(where: { shareToken: string } | { portalToken: string; offerId: string }) {
  if ("shareToken" in where) {
    if (where.shareToken.length < 20) return null;
    return prisma.offer.findUnique({ where: { shareToken: where.shareToken }, include: { company: { select: { slug: true } } } });
  }
  const customer = await portalCustomer(where.portalToken);
  if (!customer) return null;
  return prisma.offer.findFirst({ where: { id: where.offerId, customerId: customer.id }, include: { company: { select: { slug: true } } } });
}

export const APPOINTMENT_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
export const APPOINTMENT_STATUS = { REQUESTED: "Requested", CONFIRMED: "Confirmed", DONE: "Done", DECLINED: "Declined", CANCELLED: "Cancelled" } as const;
export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS;

export const THREAD_TOPICS = { QUESTION: "Question", QUOTE: "Quote request", CLAIM: "Warranty claim", SERVICE: "Service", INFO: "Update" } as const;
export type ThreadTopic = keyof typeof THREAD_TOPICS;
