"use server";

import { returnTarget } from "@/lib/return-to";
import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { toRecycleBin } from "@/lib/recycle-bin";
import { deleteRefusal } from "@/lib/delete-rules";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { salesTags } from "@/lib/data/sales";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import {
  MAX_INSTALLMENTS,
  isOfferStatus,
  isPaymentPlan,
  lineTotal,
  offerTotals,
  schedulePayments,
  scheduleProblem,
  termsForPlan,
} from "@/lib/offers";
import type { CompanySlug } from "@/lib/permissions";

export type OfferFormState = { error?: string };

const NUMBER_PREFIX: Record<CompanySlug, string> = { "xpert-marine": "XM", "eliche-radice": "ER" };

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

const offerSchema = z
  .object({
    customerId: z.string().optional().transform((v) => v || null),
    saveCustomer: z.boolean().default(true),
    vesselId: z.string().optional().transform((v) => v || null),
    incoterm: text(20),
    deliveryPlace: text(200),
    leadTime: text(200),
    warranty: text(500),
    customerName: z.string().trim().min(2, "Enter the customer's name").max(200),
    customerAttention: text(200),
    customerAddress: text(1000),
    customerEmail: text(200),
    customerPhone: text(100),
    subject: text(300),
    reference: text(200),
    offerDate: date,
    validUntil: date,
    status: z.string().refine(isOfferStatus, "Unknown status"),
    marking: text(100),
    intro: text(5000),
    terms: text(10000),
    notes: text(5000),
    discountType: z.enum(["PERCENT", "AMOUNT"]),
    discountValue: z.number().min(0, "Discount can't be negative"),
    applyVat: z.boolean(),
    paymentPlan: z.string().refine(isPaymentPlan, "Choose a payment plan"),
    installments: z.number().int().min(1).max(MAX_INSTALLMENTS, `At most ${MAX_INSTALLMENTS} payments`),
    paymentTerms: z
      .array(
        z.object({
          label: z.string().trim().max(200),
          value: z.number().min(0).max(100),
          dueDays: z.number().int().min(0, "Due days can't be negative").max(3650),
        }),
      )
      .max(MAX_INSTALLMENTS),
    lines: z
      .array(
        z.object({
          kind: z.enum(["ITEM", "SECTION"]),
          productId: z.string().nullish(),
          code: z.string().max(20).nullish(),
          title: z.string().trim().min(1, "Every line needs a title").max(500),
          description: z.string().trim().max(5000).nullish(),
          quantity: z.number().min(0, "Quantities can't be negative"),
          unit: z.string().trim().max(30).nullish(),
          unitPrice: z.number().min(0, "Prices can't be negative"),
          discountPercent: z.number().min(0).max(100, "Line discounts are 0–100%"),
        }),
      )
      .min(1, "Add at least one line")
      .max(500),
  })
  .refine((o) => o.validUntil >= o.offerDate, { message: "“Valid until” must be on or after the offer date" })
  .refine((o) => o.discountType === "AMOUNT" || o.discountValue <= 100, { message: "A percentage discount can't exceed 100%" });

type OfferInput = z.infer<typeof offerSchema>;

function offerData(data: OfferInput, customerId: string | null) {
  const totals = offerTotals(data.lines, data.discountType, data.discountValue, data.applyVat);
  return {
    customerId,
    vesselId: data.vesselId,
    incoterm: data.incoterm,
    deliveryPlace: data.deliveryPlace,
    leadTime: data.leadTime,
    warranty: data.warranty,
    customerName: data.customerName,
    customerAttention: data.customerAttention,
    customerAddress: data.customerAddress,
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
    subject: data.subject,
    reference: data.reference,
    offerDate: new Date(`${data.offerDate}T00:00:00Z`),
    validUntil: new Date(`${data.validUntil}T00:00:00Z`),
    status: data.status,
    marking: data.marking,
    intro: data.intro,
    terms: data.terms,
    notes: data.notes,
    discountType: data.discountType,
    discountValue: data.discountValue,
    applyVat: data.applyVat,
    paymentPlan: data.paymentPlan,
    ...totals,
  };
}

/** Schedule rows to store, with amounts worked out from the offer total; or an error. */
function scheduleRows(data: OfferInput): { rows: Prisma.OfferPaymentTermCreateWithoutOfferInput[] } | { error: string } {
  const plan = data.paymentPlan as "FULL" | "PERCENT" | "INSTALLMENTS";
  const terms = termsForPlan(
    plan,
    data.paymentTerms.map((t) => ({ label: t.label, mode: "PERCENT" as const, value: t.value, dueDays: t.dueDays })),
    data.installments,
  );
  const problem = scheduleProblem(plan, terms);
  if (problem) return { error: problem };
  const { totalTTC } = offerTotals(data.lines, data.discountType, data.discountValue, data.applyVat);
  const { payments } = schedulePayments(terms, totalTTC);
  return {
    rows: payments.map((p, position) => ({
      position,
      label: p.label.trim(),
      mode: p.mode,
      value: p.value,
      percent: p.percent,
      amount: p.amount,
      dueDays: p.dueDays,
    })),
  };
}

function lineRows(data: OfferInput, catalogueIds: Set<string>) {
  return data.lines.map((l, position) => {
    const section = l.kind === "SECTION";
    return {
      position,
      kind: l.kind,
      // Drop links to catalogue items that were deleted meanwhile.
      productId: l.productId && catalogueIds.has(l.productId) ? l.productId : null,
      code: section ? null : (l.code ?? null),
      title: l.title,
      description: l.description || null,
      quantity: section ? 0 : l.quantity,
      unit: section ? null : l.unit || null,
      unitPrice: section ? 0 : l.unitPrice,
      discountPercent: section ? 0 : l.discountPercent,
      lineTotal: section ? 0 : lineTotal(l),
    };
  });
}

/** Link to a saved customer, creating one from the typed details if asked. */
async function resolveCustomer(data: OfferInput) {
  if (data.customerId) {
    const exists = await prisma.customer.findUnique({ where: { id: data.customerId }, select: { id: true } });
    if (exists) return exists.id;
  }
  if (!data.saveCustomer) return null;
  const customer = await prisma.customer.upsert({
    where: { name: data.customerName },
    update: {},
    create: {
      name: data.customerName,
      contactName: data.customerAttention,
      address: data.customerAddress,
      email: data.customerEmail,
      phone: data.customerPhone,
    },
    select: { id: true },
  });
  updateTag(salesTags.customers);
  return customer.id;
}

async function nextOfferNumber(tx: Tx, slug: CompanySlug, year: number) {
  const prefix = `${NUMBER_PREFIX[slug]}-OF-${year}-`;
  const last = await tx.offer.findFirst({
    where: { number: { startsWith: prefix }, revision: 0 },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const next = last ? Number(last.number.slice(prefix.length, prefix.length + 4)) + 1 : 1;
  return prefix + String(next).padStart(4, "0");
}

/** Create (offerId = null) or update an offer of the company being viewed. */
export async function saveOffer(
  companySlug: string,
  offerId: string | null,
  _prev: OfferFormState,
  formData: FormData,
): Promise<OfferFormState> {
  const { user, slug } = await requireModule(companySlug, "offers");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = offerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const schedule = scheduleRows(data);
  if ("error" in schedule) return { error: schedule.error };

  const companyId = await companyIdFor(slug);
  const productIds = [...new Set(data.lines.map((l) => l.productId).filter((id): id is string => !!id))];
  const [customerId, existing, catalogue] = await Promise.all([
    resolveCustomer(data),
    offerId
      ? prisma.offer.findFirst({
          where: { id: offerId, companyId },
          select: { id: true, _count: { select: { invoices: { where: { status: { not: "CANCELLED" } } } } } },
        })
      : null,
    productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } }) : [],
  ]);
  if (offerId && !existing) return { error: "This offer no longer exists." };
  if (existing && existing._count.invoices > 0) {
    return { error: "This offer has invoices, so it is locked. Cancel its invoices, or duplicate it to make a new version." };
  }
  const catalogueIds = new Set(catalogue.map((p) => p.id));

  let savedId: string;
  if (existing) {
    await prisma.offer.update({
      where: { id: existing.id },
      data: {
        ...offerData(data, customerId),
        lines: { deleteMany: {}, create: lineRows(data, catalogueIds) },
        paymentTerms: { deleteMany: {}, create: schedule.rows },
      },
    });
    savedId = existing.id;
  } else {
    const year = Number(data.offerDate.slice(0, 4));
    let attempt = 0;
    for (;;) {
      try {
        savedId = await prisma.$transaction(async (tx) => {
          const offer = await tx.offer.create({
            select: { id: true },
            data: {
              ...offerData(data, customerId),
              companyId,
              number: await nextOfferNumber(tx, slug, year),
              createdById: user.id,
              lines: { create: lineRows(data, catalogueIds) },
              paymentTerms: { create: schedule.rows },
            },
          });
          return offer.id;
        }, TRANSACTION_OPTIONS);
        break;
      } catch (e) {
        // Two offers saved at the same moment can race for a number; retry.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt++ < 3) continue;
        throw e;
      }
    }
  }

  updateTag(salesTags.offers(companyId));
  redirect(returnTarget(slug, formData, "Offer saved.") ?? `/c/${slug}/offers/${savedId}?saved=1`);
}

/** Copy an offer into a new draft dated today (for re-quoting). */
export async function duplicateOffer(companySlug: string, offerId: string) {
  const { user, slug } = await requireModule(companySlug, "offers");
  const companyId = await companyIdFor(slug);
  const source = await prisma.offer.findFirst({
    where: { id: offerId, companyId },
    include: { lines: true, paymentTerms: true },
  });
  if (!source) return;

  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const validity = source.validUntil.getTime() - source.offerDate.getTime();
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { id, number, createdAt, updatedAt, createdById, lines, paymentTerms, ...fields } = source;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const copy = await prisma.$transaction(async (tx) => {
    return tx.offer.create({
      select: { id: true },
      data: {
        ...fields,
        status: "DRAFT",
        offerDate: today,
        validUntil: new Date(today.getTime() + validity),
        number: await nextOfferNumber(tx, slug, today.getUTCFullYear()),
        createdById: user.id,
        lines: {
          create: lines.map((l) => ({
            position: l.position,
            kind: l.kind,
            productId: l.productId,
            code: l.code,
            title: l.title,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            discountPercent: l.discountPercent,
            lineTotal: l.lineTotal,
          })),
        },
        paymentTerms: {
          create: paymentTerms.map((t) => ({
            position: t.position,
            label: t.label,
            mode: t.mode,
            value: t.value,
            percent: t.percent,
            amount: t.amount,
            dueDays: t.dueDays,
          })),
        },
      },
    });
  }, TRANSACTION_OPTIONS);

  updateTag(salesTags.offers(companyId));
  redirect(`/c/${slug}/offers/${copy.id}?saved=copy`);
}

/** Change an offer's status from the list without opening it (allowed even when invoiced). */
export async function setOfferStatus(companySlug: string, offerId: string, status: string) {
  const { slug } = await requireModule(companySlug, "offers");
  if (!isOfferStatus(status)) return;
  const companyId = await companyIdFor(slug);
  await prisma.offer.updateMany({ where: { id: offerId, companyId }, data: { status } });
  updateTag(salesTags.offers(companyId));
}

/** Delete an offer that has never been invoiced (cancelled invoices are kept for accounting). */
export async function deleteOffer(companySlug: string, offerId: string): Promise<{ error?: string }> {
  const { user, slug } = await requireModule(companySlug, "offers");
  const companyId = await companyIdFor(slug);
  const offer = await prisma.offer.findFirst({
    where: { id: offerId, companyId },
    select: { status: true, number: true, customerName: true, _count: { select: { invoices: true } } },
  });
  if (!offer) return { error: "This offer no longer exists." };
  const draft = offer.status === "DRAFT";
  const refused = deleteRefusal(user, draft ? "draft" : "posted");
  if (refused) return { error: draft ? refused : "Only the admin can delete an offer that was sent. Mark it as rejected instead." };
  if (offer._count.invoices > 0) return { error: "This offer has invoices, so it can't be deleted." };
  await prisma.$transaction(async (tx) => {
    await toRecycleBin(tx, { model: "Offer", id: offerId, companyId, label: `Offer ${offer.number} · ${offer.customerName}`, deletedByName: user.name });
    await tx.offer.delete({ where: { id: offerId } });
  }, TRANSACTION_OPTIONS);
  updateTag(salesTags.offers(companyId));
  redirect(`/c/${slug}/offers`);
}

/**
 * New revision of an offer (Rev. 1, Rev. 2…): a copy with the same base number and "-R1", "-R2"…,
 * to edit and send again. The previous version is kept as it was.
 */
export async function reviseOffer(companySlug: string, offerId: string) {
  const { user, slug } = await requireModule(companySlug, "offers");
  const companyId = await companyIdFor(slug);
  const offer = await prisma.offer.findFirst({ where: { id: offerId, companyId }, include: { lines: true, paymentTerms: true } });
  if (!offer) redirect(`/c/${slug}/offers`);
  const base = offer.number.replace(/-R\d+$/, "");
  const siblings = await prisma.offer.findMany({ where: { number: { startsWith: `${base}-R` } }, select: { revision: true } });
  const revision = Math.max(offer.revision, ...siblings.map((x) => x.revision)) + 1;
  const { id: _id, number: _n, lines, paymentTerms, createdAt: _c, updatedAt: _u, shareToken: _t, respondedAt: _ra, respondedName: _rn, customerNote: _cn, ...rest } = offer;
  void _id; void _n; void _c; void _u; void _t; void _ra; void _rn; void _cn;
  const created = await prisma.offer.create({
    select: { id: true },
    data: {
      ...rest,
      number: `${base}-R${revision}`,
      revision,
      revisionOf: offer.id,
      status: "DRAFT",
      offerDate: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`),
      createdById: user.id,
      lines: { create: lines.map(({ id: _lid, offerId: _oid, ...l }) => (void _lid, void _oid, l)) },
      paymentTerms: { create: paymentTerms.map(({ id: _pid, offerId: _poid, ...t }) => (void _pid, void _poid, t)) },
    },
  });
  updateTag(salesTags.offers(companyId));
  redirect(`/c/${slug}/offers/${created.id}?saved=1`);
}

// ── Standard clauses ──

export async function saveClause(companySlug: string, _prev: OfferFormState, formData: FormData): Promise<OfferFormState> {
  const { slug } = await requireModule(companySlug, "offers");
  const companyId = await companyIdFor(slug);
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("text") ?? "").trim().slice(0, 5000);
  if (title.length < 2 || body.length < 3) return { error: "Give the clause a title and its text." };
  await prisma.offerClause.create({ data: { companyId, title, text: body } });
  updateTag(salesTags.offers(companyId));
  redirect(`/c/${slug}/offers?clauses=1`);
}

export async function deleteClause(companySlug: string, clauseId: string): Promise<{ error?: string }> {
  const { user, slug } = await requireModule(companySlug, "offers");
  const companyId = await companyIdFor(slug);
  const clause = await prisma.offerClause.findFirst({ where: { id: clauseId, companyId }, select: { title: true } });
  if (!clause) return {};
  await prisma.$transaction(async (tx) => {
    await toRecycleBin(tx, { model: "OfferClause", id: clauseId, companyId, label: `Standard clause · ${clause.title}`, deletedByName: user.name });
    await tx.offerClause.delete({ where: { id: clauseId } });
  });
  updateTag(salesTags.offers(companyId));
  return {};
}

/** Render the offer PDF from the editor's current (unsaved) content, for the live preview. */
export async function previewOffer(companySlug: string, payload: string): Promise<{ error?: string; pdf?: string }> {
  const { user, slug } = await requireModule(companySlug, "offers");
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return { error: "The form couldn't be read." };
  }
  const parsed = offerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const schedule = scheduleRows(data);
  const totals = offerTotals(data.lines, data.discountType, data.discountValue, data.applyVat);
  const { createElement } = await import("react");
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { OfferPdf } = await import("@/lib/pdf/offer-pdf");
  const { getCompanyProfile } = await import("@/lib/data/sales");
  const { isBilingual } = await import("@/lib/pdf-language");
  const offer = {
    ...offerData(data, data.customerId),
    id: "preview",
    number: "PREVIEW",
    status: "DRAFT" as const,
    discountType: data.discountType,
    paymentPlan: data.paymentPlan as "FULL" | "PERCENT" | "INSTALLMENTS",
    ...totals,
    respondedAt: null,
    respondedName: null,
    customerNote: null,
    revision: 0,
    revisionOf: null,
    customerTaxNumber: null,
    createdByName: user.name,
    createdByEmail: user.email,
    paymentTerms: "rows" in schedule
      ? schedule.rows.map((r, i) => ({ id: String(i), label: r.label, mode: r.mode as "PERCENT" | "BALANCE", value: Number(r.value), percent: Number(r.percent), amount: Number(r.amount), dueDays: r.dueDays ?? 0, invoice: null }))
      : [],
    locked: false,
    invoiceCount: 0,
    invoicedTTC: 0,
    customInvoices: [],
    lines: data.lines.map((l, i) => ({
      id: String(i),
      kind: l.kind,
      productId: l.productId ?? null,
      code: l.code ?? null,
      title: l.title,
      description: l.description ?? null,
      quantity: l.quantity,
      unit: l.unit ?? null,
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent,
      lineTotal: l.kind === "SECTION" ? 0 : lineTotal(l),
    })),
  };
  const element = createElement(OfferPdf, { slug, offer: offer as never, company: await getCompanyProfile(slug), bilingual: await isBilingual(data.customerId) });
  const buf = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
  return { pdf: Buffer.from(buf).toString("base64") };
}
