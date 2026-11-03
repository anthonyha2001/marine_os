import "server-only";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import { getCompanyProfile, listCustomers } from "@/lib/data/sales";
import type { CompanySlug } from "@/lib/permissions";
import type { CustomerOption } from "../offers/offer-editor";
import type { OfferOption } from "./letter-editor";

/** Everything the letter editor needs besides the letter itself. */
export async function letterEditorData(slug: CompanySlug) {
  const companyId = await companyIdFor(slug);
  const [customers, company, offers] = await Promise.all([
    listCustomers(),
    getCompanyProfile(slug),
    prisma.offer.findMany({
      where: { companyId },
      select: { id: true, number: true, customerId: true, customerName: true, subject: true },
      orderBy: [{ offerDate: "desc" }, { number: "desc" }],
      take: 500,
    }),
  ]);
  const customerOptions: CustomerOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    address: c.address,
  }));
  return { customers: customerOptions, company, offers: offers satisfies OfferOption[] };
}
