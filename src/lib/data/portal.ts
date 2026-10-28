import "server-only";
import { prisma } from "@/lib/prisma";
import { invoicesWithBalance } from "@/lib/data/ledger";
import { COMPANY_SLUGS, COMPANIES, type CompanySlug } from "@/lib/permissions";

// What a customer sees through their private portal link. Read fresh (never cached) and only
// ever filtered by the customer the token belongs to.

export async function portalCustomer(token: string) {
  if (!token || token.length < 20) return null;
  return prisma.customer.findUnique({ where: { portalToken: token }, select: { id: true, name: true, email: true, phone: true } });
}

export async function portalData(customerId: string) {
  const [vessels, offers, appointments, companies] = await Promise.all([
    prisma.vessel.findMany({ where: { customerId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, make: true, model: true } }),
    prisma.offer.findMany({
      where: { customerId, status: { in: ["SENT", "ACCEPTED"] } },
      orderBy: { offerDate: "desc" },
      take: 30,
      select: { id: true, number: true, subject: true, offerDate: true, validUntil: true, status: true, totalTTC: true, company: { select: { slug: true } } },
    }),
    prisma.appointment.findMany({
      where: { customerId },
      orderBy: { date: "desc" },
      take: 30,
      select: { id: true, number: true, date: true, time: true, status: true, reason: true, vessel: { select: { name: true } }, company: { select: { slug: true } } },
    }),
    prisma.company.findMany({ select: { id: true, slug: true } }),
  ]);
  // Invoices with balances, per company.
  const invoices = (
    await Promise.all(
      COMPANY_SLUGS.map(async (slug) =>
        (await invoicesWithBalance(slug)).filter((i) => i.customerId === customerId).map((i) => ({ ...i, company: slug as CompanySlug })),
      ),
    )
  ).flat();
  return {
    vessels,
    offers: offers.map((o) => ({ ...o, company: o.company.slug as CompanySlug, totalTTC: Number(o.totalTTC) })),
    appointments: appointments.map((a) => ({ ...a, company: a.company.slug as CompanySlug })),
    invoices,
    companies: companies.map((c) => ({ ...c, name: COMPANIES[c.slug as CompanySlug].name })),
  };
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
