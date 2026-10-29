"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { salesTags } from "@/lib/data/sales";
import { COMPANIES } from "@/lib/permissions";

// Prepares a message with a private link to a document, for the "Send" button (WhatsApp or email).

export type SendKind = "invoice" | "offer" | "statement" | "portal";
export type SendResult = { error?: string; phone?: string | null; email?: string | null; subject?: string; message?: string; url?: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** The customer's portal token, created the first time it's needed. */
async function portalTokenFor(customerId: string) {
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { portalToken: true } });
  if (c?.portalToken) return c.portalToken;
  const token = randomBytes(24).toString("base64url");
  await prisma.customer.update({ where: { id: customerId }, data: { portalToken: token } });
  updateTag(salesTags.customers);
  return token;
}

export async function prepareSend(companySlug: string, kind: SendKind, id: string): Promise<SendResult> {
  const mod = kind === "offer" ? "offers" : kind === "invoice" ? "invoices" : "customers";
  const { user, slug } = await requireModule(companySlug, mod);
  const companyId = await companyIdFor(slug);
  const company = COMPANIES[slug].name;
  const base = await origin();
  const sign = `\n\n${user.name}\n${company}`;

  if (kind === "invoice") {
    const inv = await prisma.invoice.findFirst({ where: { id, companyId }, include: { customer: true } });
    if (!inv) return { error: "This invoice no longer exists." };
    if (!inv.customer) return { error: "Save this customer first (Customers page) to send them a private link." };
    const url = `${base}/p/${await portalTokenFor(inv.customer.id)}/invoices/${inv.id}/pdf`;
    return {
      phone: inv.customer.phone ?? inv.customerPhone,
      email: inv.customer.email ?? inv.customerEmail,
      subject: `Invoice ${inv.number} from ${company}`,
      message: `Dear ${inv.customer.contactName ?? inv.customerName},\n\nPlease find our invoice ${inv.number} of ${money.format(Number(inv.totalTTC))}, due on ${day.format(inv.dueDate)}:\n${url}${sign}`,
      url,
    };
  }
  if (kind === "offer") {
    const offer = await prisma.offer.findFirst({ where: { id, companyId }, include: { customer: true } });
    if (!offer) return { error: "This offer no longer exists." };
    let token = offer.shareToken;
    if (!token) {
      token = randomBytes(24).toString("base64url");
      await prisma.offer.update({ where: { id }, data: { shareToken: token, status: offer.status === "DRAFT" ? "SENT" : offer.status } });
      updateTag(salesTags.offers(companyId));
    }
    const url = `${base}/p/o/${token}`;
    return {
      phone: offer.customer?.phone ?? offer.customerPhone,
      email: offer.customer?.email ?? offer.customerEmail,
      subject: `Offer ${offer.number}${offer.subject ? ` · ${offer.subject}` : ""} — ${company}`,
      message: `Dear ${offer.customerAttention ?? offer.customerName},\n\nPlease find our offer ${offer.number}${offer.subject ? ` for ${offer.subject}` : ""} (${money.format(Number(offer.totalTTC))}, valid until ${day.format(offer.validUntil)}). You can read it and accept it online here:\n${url}${sign}`,
      url,
    };
  }
  // Statement and portal: by customer.
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return { error: "This customer no longer exists." };
  const token = await portalTokenFor(customer.id);
  const url = kind === "statement" ? `${base}/p/${token}/statement/${slug}` : `${base}/p/${token}`;
  return {
    phone: customer.phone,
    email: customer.email,
    subject: kind === "statement" ? `Statement of account — ${company}` : `Your customer portal — ${company}`,
    message:
      kind === "statement"
        ? `Dear ${customer.contactName ?? customer.name},\n\nPlease find your statement of account with ${company}:\n${url}${sign}`
        : `Dear ${customer.contactName ?? customer.name},\n\nHere is your private customer portal: your boats, invoices and offers, and you can book appointments online:\n${url}\nPlease keep this link private.${sign}`,
    url,
  };
}
