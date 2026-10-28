"use server";

import { randomBytes } from "crypto";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { salesTags } from "@/lib/data/sales";

// Private links for customers: the portal (per customer) and online approval (per offer).
const token = () => randomBytes(24).toString("base64url");

/** Create (or replace, which disables the old link) a customer's portal link. */
export async function resetPortalLink(companySlug: string, customerId: string): Promise<{ error?: string; token?: string }> {
  await requireModule(companySlug, "customers");
  const t = token();
  const updated = await prisma.customer.updateMany({ where: { id: customerId }, data: { portalToken: t } });
  if (!updated.count) return { error: "This customer no longer exists." };
  updateTag(salesTags.customers);
  return { token: t };
}

export async function disablePortalLink(companySlug: string, customerId: string): Promise<{ error?: string }> {
  await requireModule(companySlug, "customers");
  await prisma.customer.updateMany({ where: { id: customerId }, data: { portalToken: null } });
  updateTag(salesTags.customers);
  return {};
}

/** Link the customer opens to see the offer and accept or decline it online. */
export async function shareOffer(companySlug: string, offerId: string): Promise<{ error?: string; token?: string }> {
  const { slug } = await requireModule(companySlug, "offers");
  const companyId = await companyIdFor(slug);
  const offer = await prisma.offer.findFirst({ where: { id: offerId, companyId }, select: { shareToken: true, status: true } });
  if (!offer) return { error: "This offer no longer exists." };
  if (offer.shareToken) return { token: offer.shareToken };
  const t = token();
  await prisma.offer.update({ where: { id: offerId }, data: { shareToken: t, status: offer.status === "DRAFT" ? "SENT" : offer.status } });
  updateTag(salesTags.offers(companyId));
  return { token: t };
}
