"use server";

import { tooMany, visitorHash } from "@/lib/visitor";
import { updateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { businessToday } from "@/lib/dates";
import { appointmentsTag } from "@/lib/data/appointments";
import { companyIdFor } from "@/lib/data/inventory";
import { APPOINTMENT_SLOTS } from "@/lib/data/portal";
import { websiteTag } from "@/lib/data/website";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { nextNumber } from "@/lib/ledger/numbering";
import { isCompanySlug } from "@/lib/permissions";

export type WebsiteFormState = { error?: string; saved?: boolean };
type Result = { error?: string };

async function ctx(companySlug: string) {
  const c = await requireModule(companySlug, "marketing");
  return { ...c, companyId: await companyIdFor(c.slug) };
}
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const done = (companyId: string) => updateTag(websiteTag(companyId));

// ── Site texts and settings ──

const settingsSchema = z.object({
  tagline: opt(120),
  heroTitle: opt(160),
  heroText: opt(600),
  heroImageId: opt(40),
  aboutTitle: opt(160),
  aboutText: opt(4000),
  aboutImageId: opt(40),
  highlights: opt(2000),
  phone: opt(60),
  whatsapp: opt(60),
  email: z.string().trim().max(200).optional().transform((v) => v || null).refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "Enter a valid email"),
  address: opt(500),
  mapQuery: opt(300),
  openingHours: opt(1000),
  facebook: opt(300),
  instagram: opt(300),
  linkedin: opt(300),
  seoTitle: opt(120),
  seoDescription: opt(300),
});

export async function saveWebsiteSettings(companySlug: string, _prev: WebsiteFormState, formData: FormData): Promise<WebsiteFormState> {
  const { companyId } = await ctx(companySlug);
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const on = (k: string) => formData.get(k) === "on";
  const data = { ...parsed.data, showCatalogue: on("showCatalogue"), showGallery: on("showGallery"), showBooking: on("showBooking") };
  await prisma.websiteSettings.upsert({ where: { companyId }, create: { companyId, ...data }, update: data });
  done(companyId);
  return { saved: true };
}

/** Publish or hide the whole site (hidden: visitors see "coming soon"). */
export async function setWebsitePublished(companySlug: string, published: boolean): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  await prisma.websiteSettings.upsert({ where: { companyId }, create: { companyId, published }, update: { published } });
  done(companyId);
  return {};
}

// ── Pictures ──

const IMAGE_TYPES = ["image/jpeg", "image/webp", "image/png"];

/** Store a picture (already resized in the browser) and return its id. */
export async function uploadWebsiteImage(companySlug: string, formData: FormData): Promise<{ id?: string; error?: string }> {
  const { companyId } = await ctx(companySlug);
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a picture." };
  if (!IMAGE_TYPES.includes(file.type)) return { error: "The picture must be JPG, PNG or WebP." };
  if (file.size > 3 * 1024 * 1024) return { error: "The picture is too large (3 MB at most)." };
  const width = Number(formData.get("width")) || null;
  const height = Number(formData.get("height")) || null;
  const image = await prisma.websiteImage.create({
    data: { companyId, contentType: file.type, data: Buffer.from(await file.arrayBuffer()), width, height },
    select: { id: true },
  });
  return { id: image.id };
}

// ── Services ──

const serviceSchema = z.object({
  title: z.string().trim().min(2, "Give the service a title").max(120),
  description: z.string().trim().min(3, "Describe the service").max(1000),
  imageId: opt(40),
});

export async function saveWebsiteService(companySlug: string, serviceId: string | null, _prev: WebsiteFormState, formData: FormData): Promise<WebsiteFormState> {
  const { companyId } = await ctx(companySlug);
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const published = formData.get("published") === "on";
  if (serviceId) {
    const found = await prisma.websiteService.updateMany({ where: { id: serviceId, companyId }, data: { ...parsed.data, published } });
    if (!found.count) return { error: "This service no longer exists." };
  } else {
    await adoptDefaultServices(companyId, formData.get("defaults"));
    const last = await prisma.websiteService.aggregate({ where: { companyId }, _max: { position: true } });
    await prisma.websiteService.create({ data: { companyId, ...parsed.data, published, position: (last._max.position ?? -1) + 1 } });
  }
  done(companyId);
  return { saved: true };
}

/** The first change to the suggested services saves them, so they can be edited one by one. */
async function adoptDefaultServices(companyId: string, defaults: FormDataEntryValue | null) {
  if (typeof defaults !== "string" || !defaults) return;
  if (await prisma.websiteService.count({ where: { companyId } })) return;
  const list = JSON.parse(defaults) as { title: string; description: string }[];
  await prisma.websiteService.createMany({ data: list.slice(0, 20).map((s, position) => ({ companyId, title: s.title.slice(0, 120), description: s.description.slice(0, 1000), position })) });
}

export async function saveDefaultServices(companySlug: string, defaults: string): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  await adoptDefaultServices(companyId, defaults);
  done(companyId);
  return {};
}

export async function deleteWebsiteService(companySlug: string, serviceId: string): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  await prisma.websiteService.deleteMany({ where: { id: serviceId, companyId } });
  done(companyId);
  return {};
}

/** Move a service or gallery picture one place up or down. */
export async function moveWebsiteItem(companySlug: string, kind: "service" | "gallery", id: string, direction: -1 | 1): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const delegate = { service: prisma.websiteService, gallery: prisma.websiteGalleryItem }[kind] as unknown as {
    findMany: (a: unknown) => Promise<{ id: string; position: number }[]>;
    update: (a: unknown) => Promise<unknown>;
  };
  const rows = await delegate.findMany({ where: { companyId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, position: true } });
  const i = rows.findIndex((r) => r.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= rows.length) return {};
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await prisma.$transaction(rows.map((r, position) => delegate.update({ where: { id: r.id }, data: { position } }) as never));
  done(companyId);
  return {};
}

// ── Gallery ──

const galleryItemSchema = z.object({
  title: z.string().trim().min(2, "Give the picture a title").max(120),
  caption: opt(500),
  imageId: z.string().min(1, "Upload a picture"),
});

export async function saveGalleryItem(companySlug: string, itemId: string | null, _prev: WebsiteFormState, formData: FormData): Promise<WebsiteFormState> {
  const { companyId } = await ctx(companySlug);
  const parsed = galleryItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await prisma.websiteImage.count({ where: { id: parsed.data.imageId, companyId } }))) return { error: "Upload the picture again." };
  if (itemId) {
    await prisma.websiteGalleryItem.updateMany({ where: { id: itemId, companyId }, data: parsed.data });
  } else {
    const last = await prisma.websiteGalleryItem.aggregate({ where: { companyId }, _max: { position: true } });
    await prisma.websiteGalleryItem.create({ data: { companyId, ...parsed.data, position: (last._max.position ?? -1) + 1 } });
  }
  done(companyId);
  return { saved: true };
}

export async function deleteGalleryItem(companySlug: string, itemId: string): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  await prisma.websiteGalleryItem.deleteMany({ where: { id: itemId, companyId } });
  done(companyId);
  return {};
}

// ── Catalogue ──
// Products appear by themselves (the ones the company stocks or bought). Here they are only
// hidden, featured, or given a website photo and description.

async function companyProduct(companyId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, OR: [{ stockMovements: { some: { companyId } } }, { purchaseItems: { some: { purchase: { companyId } } } }] },
    select: { id: true },
  });
}

export async function setListingFlag(companySlug: string, productId: string, flag: "hidden" | "featured", value: boolean): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  if (!(await companyProduct(companyId, productId))) return { error: "This product isn't in this company's catalogue." };
  await prisma.websiteListing.upsert({
    where: { companyId_productId: { companyId, productId } },
    create: { companyId, productId, [flag]: value },
    update: { [flag]: value },
  });
  done(companyId);
  return {};
}

const listingSchema = z.object({ description: opt(2000), imageId: opt(40) });

export async function saveListing(companySlug: string, productId: string, _prev: WebsiteFormState, formData: FormData): Promise<WebsiteFormState> {
  const { companyId } = await ctx(companySlug);
  const parsed = listingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await companyProduct(companyId, productId))) return { error: "This product isn't in this company's catalogue." };
  await prisma.websiteListing.upsert({
    where: { companyId_productId: { companyId, productId } },
    create: { companyId, productId, ...parsed.data },
    update: parsed.data,
  });
  done(companyId);
  return { saved: true };
}

// ── Inbox ──

export async function setMessageHandled(companySlug: string, messageId: string, handled: boolean): Promise<Result> {
  const { user, companyId } = await ctx(companySlug);
  await prisma.websiteMessage.updateMany({
    where: { id: messageId, companyId },
    data: handled ? { status: "HANDLED", handledAt: new Date(), handledByName: user.name } : { status: "NEW", handledAt: null, handledByName: null },
  });
  done(companyId);
  return {};
}

// ── From visitors (public, no login) ──

export type PublicFormState = { error?: string; sent?: boolean };

async function publicCompany(slug: string) {
  if (!isCompanySlug(slug)) return null;
  return prisma.company.findUnique({ where: { slug }, select: { id: true } });
}


const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().max(200).optional().transform((v) => v || null).refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "Please enter a valid email"),
  phone: z.string().trim().max(60).optional().transform((v) => v || null),
  message: z.string().trim().min(5, "Please write a short message").max(3000),
  productId: z.string().optional().transform((v) => v || null),
});

/** Contact form and "Ask for a quote" (with a product). */
export async function sendWebsiteMessage(slug: string, _prev: PublicFormState, formData: FormData): Promise<PublicFormState> {
  if (formData.get("website")) return { sent: true }; // hidden field only bots fill in
  const company = await publicCompany(slug);
  if (!company) return { error: "This website is not available." };
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!d.email && !d.phone) return { error: "Please give us an email or a phone number so we can reply." };
  const ipHash = await visitorHash();
  if (await tooMany(company.id, ipHash)) return { error: "We received several messages from you already. We'll get back to you soon." };
  const found = d.productId ? await companyProduct(company.id, d.productId) : null;
  const product = found ? { product: await prisma.product.findUniqueOrThrow({ where: { id: found.id }, select: { id: true, name: true, code: true } }) } : null;
  await prisma.websiteMessage.create({
    data: {
      companyId: company.id,
      kind: product ? "QUOTE" : "CONTACT",
      name: d.name,
      email: d.email,
      phone: d.phone,
      message: d.message,
      productId: product?.product.id ?? null,
      productName: product ? `${product.product.code} · ${product.product.name}` : null,
      ipHash,
    },
  });
  return { sent: true };
}

const bookingSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  phone: z.string().trim().min(6, "Please enter your phone number").max(60),
  email: z.string().trim().max(200).optional().transform((v) => v || null).refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "Please enter a valid email"),
  boat: z.string().trim().max(200).optional().transform((v) => v || null),
  reason: z.string().trim().min(3, "Tell us what you need").max(1500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z.string().refine((t) => APPOINTMENT_SLOTS.includes(t), "Choose a time"),
});

/** Booking request from the website: lands in Appointments (to confirm) and in the website inbox. */
export async function bookFromWebsite(slug: string, _prev: PublicFormState, formData: FormData): Promise<PublicFormState> {
  if (formData.get("website")) return { sent: true };
  const company = await publicCompany(slug);
  if (!company) return { error: "This website is not available." };
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.date <= businessToday()) return { error: "Please choose a date from tomorrow on." };
  if (new Date(`${d.date}T00:00:00Z`).getUTCDay() === 0) return { error: "We are closed on Sundays. Please choose another day." };
  const ipHash = await visitorHash();
  if (await tooMany(company.id, ipHash)) return { error: "We received several requests from you already. We'll call you soon." };
  const date = new Date(`${d.date}T00:00:00Z`);
  const note = [d.boat && `Boat: ${d.boat}`, d.email && `Email: ${d.email}`, "Booked on the website"].filter(Boolean).join(" · ");
  await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      select: { id: true },
      data: {
        companyId: company.id,
        number: await nextNumber(tx, company.id, "AP", date.getUTCFullYear()),
        customerName: d.name,
        phone: d.phone,
        reason: d.reason,
        requestedDate: date,
        requestedTime: d.time,
        date,
        time: d.time,
        source: "WEBSITE",
        customerNote: note,
      },
    });
    await tx.websiteMessage.create({
      data: {
        companyId: company.id,
        kind: "BOOKING",
        name: d.name,
        email: d.email,
        phone: d.phone,
        message: `${d.reason}\n\nRequested: ${d.date} at ${d.time}${d.boat ? `\nBoat: ${d.boat}` : ""}`,
        appointmentId: appointment.id,
        ipHash,
      },
    });
  }, TRANSACTION_OPTIONS);
  updateTag(appointmentsTag(company.id));
  return { sent: true };
}
