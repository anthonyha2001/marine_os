"use server";

import { randomBytes } from "crypto";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { salesTags } from "@/lib/data/sales";
import { vesselsTag } from "@/lib/data/vessels";
import { isCompanySlug } from "@/lib/permissions";
import { tooMany, visitorHash } from "@/lib/visitor";

// "My account" on the website: new customers create their account and enter their app straight
// away; known customers ask for their private link, which the team sends (WhatsApp) from
// Customers → Messages. Nobody gets into an existing account just by typing a phone number.

export type AccountState = { error?: string; requested?: boolean };

const digits = (v: string) => v.replace(/\D/g, "").replace(/^(00)?961/, "").replace(/^0+/, "");

async function findCustomer(phone: string | null, email: string | null) {
  if (email) {
    const byEmail = await prisma.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (byEmail) return byEmail;
  }
  if (phone) {
    const want = digits(phone);
    if (want.length >= 6) {
      // Compare digits only: phones are saved as typed ("70 123 456", "+961 70…").
      const tail = want.slice(-6);
      const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Customer" WHERE regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') LIKE ${"%" + tail}`;
      const candidates = rows.length ? await prisma.customer.findMany({ where: { id: { in: rows.map((r) => r.id) } } }) : [];
      const hit = candidates.find((c) => c.phone && digits(c.phone) === want);
      if (hit) return hit;
    }
  }
  return null;
}

/** Ask the team for the private link (or tell the visitor to create an account). */
async function requestLink(companyId: string, customer: { id: string; name: string; portalToken: string | null }, ipHash: string) {
  if (!customer.portalToken) await prisma.customer.update({ where: { id: customer.id }, data: { portalToken: randomBytes(24).toString("base64url") } });
  await prisma.$transaction([
    prisma.portalThread.create({
      data: {
        companyId,
        customerId: customer.id,
        subject: "Account link requested from the website",
        topic: "INFO",
        messages: { create: { fromCustomer: true, authorName: customer.name, body: "Please send me the link to my account. (Use “Tell them on WhatsApp” after answering.)" } },
      },
    }),
    // also counts against the visitor's hourly limit
    prisma.websiteMessage.create({ data: { companyId, kind: "CONTACT", name: customer.name, message: "Asked for their customer-app link (see Customers → Messages).", status: "HANDLED", ipHash } }),
  ]);
  updateTag(salesTags.customers);
}

const askSchema = z.object({ who: z.string().trim().min(5, "Enter your phone number or email").max(200) });

export async function askForMyLink(slug: string, _prev: AccountState, formData: FormData): Promise<AccountState> {
  if (formData.get("website")) return { requested: true }; // only bots fill in the hidden field
  if (!isCompanySlug(slug)) return { error: "This website is not available." };
  const parsed = askSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const company = await prisma.company.findUniqueOrThrow({ where: { slug }, select: { id: true } });
  const ipHash = await visitorHash();
  if (await tooMany(company.id, ipHash)) return { error: "We received several requests from you already. We'll contact you soon." };
  const who = parsed.data.who;
  const customer = await findCustomer(who.includes("@") ? null : who, who.includes("@") ? who : null);
  // Same answer whether or not we know the number, so nobody can test who is a customer.
  if (customer) await requestLink(company.id, customer, ipHash);
  else await prisma.websiteMessage.create({ data: { companyId: company.id, kind: "CONTACT", name: "Unknown visitor", phone: who.includes("@") ? null : who, email: who.includes("@") ? who : null, message: "Asked for an account link, but no customer has this phone or email. Call them back or ask them to create an account.", ipHash } });
  return { requested: true };
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Enter your name or your company's").max(120),
  phone: z.string().trim().min(6, "Enter your phone number").max(60),
  email: z.union([z.literal(""), z.string().trim().email("Check the email address").max(200)]).transform((v) => v || null),
  boat: z.string().trim().max(120).optional().transform((v) => v || null),
});

export async function createMyAccount(slug: string, _prev: AccountState, formData: FormData): Promise<AccountState> {
  if (formData.get("website")) return { requested: true };
  if (!isCompanySlug(slug)) return { error: "This website is not available." };
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const company = await prisma.company.findUniqueOrThrow({ where: { slug }, select: { id: true } });
  const ipHash = await visitorHash();
  if (await tooMany(company.id, ipHash, 3)) return { error: "We received several requests from you already. We'll contact you soon." };

  // Already a customer (same phone, email or name): send the link instead of opening the account here.
  const known = (await findCustomer(d.phone, d.email)) ?? (await prisma.customer.findUnique({ where: { name: d.name } }));
  if (known) {
    await requestLink(company.id, known, ipHash);
    return { requested: true };
  }

  const token = randomBytes(24).toString("base64url");
  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({ data: { name: d.name, phone: d.phone, email: d.email, portalToken: token, notes: "Created from the website (My account)." } });
    if (d.boat) await tx.vessel.create({ data: { name: d.boat, customerId: customer.id } });
    await tx.websiteMessage.create({ data: { companyId: company.id, kind: "CONTACT", name: d.name, phone: d.phone, email: d.email, message: `New customer account created on the website${d.boat ? ` (boat: ${d.boat})` : ""}.`, ipHash } });
  });
  updateTag(salesTags.customers);
  if (d.boat) updateTag(vesselsTag);
  redirect(`/p/${token}?welcome=1`);
}
