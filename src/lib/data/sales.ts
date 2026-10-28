import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import type { CompanySlug } from "@/lib/permissions";
import type { DiscountType, InvoiceStatus, OfferStatus, PaymentMode, PaymentPlan } from "@/lib/offers";

// Cached like inventory reads; mutations call updateTag() with these tags.
export const salesTags = {
  customers: "customers",
  offers: (companyId: string) => `offers:${companyId}`,
  invoices: (companyId: string) => `invoices:${companyId}`,
  company: (companyId: string) => `company:${companyId}`,
};

export async function listCustomers() {
  "use cache";
  cacheTag(salesTags.customers);
  cacheLife("hours");
  return prisma.customer.findMany({ orderBy: { name: "asc" } });
}

export type CompanyProfile = {
  id: string;
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxNumber: string | null;
  registrationNumber: string | null;
  bankDetails: string | null;
  offerTerms: string | null;
  labourCostPerHour: number;
};

async function loadCompanyProfile(companyId: string): Promise<CompanyProfile> {
  "use cache";
  cacheTag(salesTags.company(companyId));
  cacheLife("hours");
  const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  return {
    id: c.id,
    name: c.name,
    legalName: c.legalName,
    address: c.address,
    phone: c.phone,
    email: c.email,
    website: c.website,
    taxNumber: c.taxNumber,
    registrationNumber: c.registrationNumber,
    bankDetails: c.bankDetails,
    offerTerms: c.offerTerms,
    labourCostPerHour: Number(c.labourCostPerHour),
  };
}

export async function getCompanyProfile(slug: CompanySlug) {
  return loadCompanyProfile(await companyIdFor(slug));
}

async function loadOffers(companyId: string) {
  "use cache";
  cacheTag(salesTags.offers(companyId));
  cacheLife("hours");
  const offers = await prisma.offer.findMany({
    where: { companyId },
    select: {
      id: true,
      number: true,
      customerName: true,
      subject: true,
      offerDate: true,
      validUntil: true,
      status: true,
      totalTTC: true,
      totalHT: true,
      // Any invoice (even cancelled) blocks deleting the offer; non-cancelled ones count as invoiced.
      invoices: { select: { status: true, totalTTC: true } },
    },
    orderBy: [{ offerDate: "desc" }, { createdAt: "desc" }],
  });
  return offers.map(({ invoices, ...o }) => ({
    ...o,
    status: o.status as OfferStatus,
    totalTTC: Number(o.totalTTC),
    totalHT: Number(o.totalHT),
    invoiceCount: invoices.length,
    invoicedTTC: invoices.filter((i) => i.status !== "CANCELLED").reduce((sum, i) => sum + Number(i.totalTTC), 0),
  }));
}

export async function listOffers(slug: CompanySlug) {
  return loadOffers(await companyIdFor(slug));
}

export type OfferDetail = NonNullable<Awaited<ReturnType<typeof loadOffer>>>;

async function loadOffer(companyId: string, id: string) {
  "use cache";
  cacheTag(salesTags.offers(companyId));
  cacheLife("hours");
  const o = await prisma.offer.findFirst({
    where: { id, companyId },
    include: {
      lines: { orderBy: { position: "asc" } },
      createdBy: { select: { name: true, email: true } },
      customer: { select: { taxNumber: true } },
      invoices: {
        select: { id: true, number: true, status: true, totalTTC: true, totalHT: true, paymentTermId: true },
        orderBy: { number: "asc" },
      },
      paymentTerms: {
        orderBy: { position: "asc" },
        include: {
          invoices: { where: { status: { not: "CANCELLED" } }, select: { id: true, number: true, status: true } },
        },
      },
    },
  });
  if (!o) return null;
  return {
    id: o.id,
    number: o.number,
    customerId: o.customerId,
    vesselId: o.vesselId,
    customerName: o.customerName,
    customerAttention: o.customerAttention,
    customerAddress: o.customerAddress,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    subject: o.subject,
    reference: o.reference,
    offerDate: o.offerDate,
    validUntil: o.validUntil,
    status: o.status as OfferStatus,
    marking: o.marking,
    intro: o.intro,
    terms: o.terms,
    notes: o.notes,
    discountType: o.discountType as DiscountType,
    discountValue: Number(o.discountValue),
    applyVat: o.applyVat,
    paymentPlan: o.paymentPlan as PaymentPlan,
    subtotal: Number(o.subtotal),
    discountTotal: Number(o.discountTotal),
    totalHT: Number(o.totalHT),
    vatAmount: Number(o.vatAmount),
    totalTTC: Number(o.totalTTC),
    customerTaxNumber: o.customer?.taxNumber ?? null,
    createdByName: o.createdBy.name,
    createdByEmail: o.createdBy.email,
    paymentTerms: o.paymentTerms.map((t) => ({
      id: t.id,
      label: t.label,
      mode: t.mode as PaymentMode,
      value: Number(t.value),
      percent: Number(t.percent),
      amount: Number(t.amount),
      dueDays: t.dueDays,
      invoice: t.invoices[0] ? { ...t.invoices[0], status: t.invoices[0].status as InvoiceStatus } : null,
    })),
    // Invoiced offers are locked so prices and schedule can't drift from the invoices.
    locked: o.invoices.some((i) => i.status !== "CANCELLED"),
    invoiceCount: o.invoices.length,
    invoicedTTC: o.invoices.filter((i) => i.status !== "CANCELLED").reduce((sum, i) => sum + Number(i.totalTTC), 0),
    // Invoices not tied to a scheduled payment (e.g. an extra $50 payment).
    customInvoices: o.invoices
      .filter((i) => !i.paymentTermId)
      .map((i) => ({ id: i.id, number: i.number, status: i.status as InvoiceStatus, totalTTC: Number(i.totalTTC) })),
    lines: o.lines.map((l) => ({
      id: l.id,
      kind: l.kind as "ITEM" | "SECTION",
      productId: l.productId,
      code: l.code,
      title: l.title,
      description: l.description,
      quantity: Number(l.quantity),
      unit: l.unit,
      unitPrice: Number(l.unitPrice),
      discountPercent: Number(l.discountPercent),
      lineTotal: Number(l.lineTotal),
    })),
  };
}

/** An offer, only if it belongs to this company. */
export async function getOffer(slug: CompanySlug, id: string) {
  return loadOffer(await companyIdFor(slug), id);
}

async function loadInvoices(companyId: string) {
  "use cache";
  cacheTag(salesTags.invoices(companyId));
  cacheLife("hours");
  const invoices = await prisma.invoice.findMany({
    where: { companyId },
    select: {
      id: true,
      number: true,
      customerId: true,
      customerName: true,
      invoiceDate: true,
      dueDate: true,
      status: true,
      totalTTC: true,
      offer: { select: { id: true, number: true } },
    },
    orderBy: [{ invoiceDate: "desc" }, { number: "desc" }],
  });
  return invoices.map((i) => ({ ...i, status: i.status as InvoiceStatus, totalTTC: Number(i.totalTTC) }));
}

export async function listInvoices(slug: CompanySlug) {
  return loadInvoices(await companyIdFor(slug));
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof loadInvoice>>>;

async function loadInvoice(companyId: string, id: string) {
  "use cache";
  cacheTag(salesTags.invoices(companyId));
  cacheLife("hours");
  const i = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      lines: { orderBy: { position: "asc" } },
      offer: { select: { id: true, number: true, offerDate: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!i) return null;
  return {
    id: i.id,
    number: i.number,
    offer: i.offer,
    customerName: i.customerName,
    customerAttention: i.customerAttention,
    customerAddress: i.customerAddress,
    customerEmail: i.customerEmail,
    customerPhone: i.customerPhone,
    customerTaxNumber: i.customerTaxNumber,
    subject: i.subject,
    reference: i.reference,
    invoiceDate: i.invoiceDate,
    dueDate: i.dueDate,
    status: i.status as InvoiceStatus,
    paidAt: i.paidAt,
    marking: i.marking,
    notes: i.notes,
    applyVat: i.applyVat,
    totalHT: Number(i.totalHT),
    vatAmount: Number(i.vatAmount),
    totalTTC: Number(i.totalTTC),
    createdByName: i.createdBy.name,
    lines: i.lines.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    })),
  };
}

/** An invoice, only if it belongs to this company. */
export async function getInvoice(slug: CompanySlug, id: string) {
  return loadInvoice(await companyIdFor(slug), id);
}
