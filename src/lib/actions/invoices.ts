"use server";

import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { salesTags } from "@/lib/data/sales";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { round2 } from "@/lib/money";
import { invoiceVatSplit, projectedPayments } from "@/lib/offers";
import { postInvoice, reverseEntries } from "@/lib/ledger/posting";
import { payablesTag } from "@/lib/data/accounting";
import { ledgerTag } from "@/lib/data/ledger";
import type { CompanySlug } from "@/lib/permissions";
import { businessToday } from "@/lib/dates";

const NUMBER_PREFIX: Record<CompanySlug, string> = { "xpert-marine": "XM", "eliche-radice": "ER" };
const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

async function nextInvoiceNumber(tx: Tx, slug: CompanySlug, year: number) {
  const prefix = `${NUMBER_PREFIX[slug]}-INV-${year}-`;
  const last = await tx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return prefix + String((last ? Number(last.number.slice(prefix.length)) : 0) + 1).padStart(4, "0");
}

/** Today (Beirut date) as midnight UTC, the way document dates are stored. */
function todayUtc() {
  return new Date(businessToday() + "T00:00:00Z");
}

/** An offer of this company with what has already been invoiced on it (non-cancelled). */
async function loadOfferForInvoicing(companyId: string, offerId: string) {
  const offer = await prisma.offer.findFirst({
    where: { id: offerId, companyId },
    include: {
      customer: { select: { taxNumber: true } },
      paymentTerms: { orderBy: { position: "asc" } },
      invoices: { where: { status: { not: "CANCELLED" } }, select: { paymentTermId: true, totalTTC: true, totalHT: true } },
    },
  });
  if (!offer) return null;
  const invoiced = {
    totalTTC: round2(offer.invoices.reduce((s, i) => s + Number(i.totalTTC), 0)),
    totalHT: round2(offer.invoices.reduce((s, i) => s + Number(i.totalHT), 0)),
  };
  return { offer, invoiced, totals: { totalHT: Number(offer.totalHT), totalTTC: Number(offer.totalTTC) } };
}

type LoadedOffer = NonNullable<Awaited<ReturnType<typeof loadOfferForInvoicing>>>["offer"];

/** Invoice fields copied from the offer (customer, references, VAT setting). */
function fromOffer(offer: LoadedOffer) {
  return {
    offerId: offer.id,
    customerId: offer.customerId,
    customerName: offer.customerName,
    customerAttention: offer.customerAttention,
    customerAddress: offer.customerAddress,
    customerEmail: offer.customerEmail,
    customerPhone: offer.customerPhone,
    customerTaxNumber: offer.customer?.taxNumber ?? null,
    subject: offer.subject,
    reference: offer.reference,
    marking: offer.marking,
    applyVat: offer.applyVat,
  };
}

function offerReference(offer: LoadedOffer) {
  return `As per our offer ${offer.number} dated ${longDate.format(offer.offerDate)}${offer.subject ? ` – ${offer.subject}` : ""}. Offer total ${money.format(Number(offer.totalTTC))} incl. VAT.`;
}

/** Run invoice creation, retrying if two people race for the same number. */
async function withNumberRetry<T>(fn: () => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 3) continue;
      throw e;
    }
  }
}

/**
 * Create invoices from an offer's payment schedule: one payment (termId) or every payment
 * that isn't invoiced yet (termId = null). Amounts are capped by what's left on the offer,
 * so custom invoices reduce the later payments. Marks the offer as accepted.
 */
export async function createInvoicesFromOffer(companySlug: string, offerId: string, termId: string | null) {
  const { user, slug } = await requireModule(companySlug, "invoices");
  const companyId = await companyIdFor(slug);
  const loaded = await loadOfferForInvoicing(companyId, offerId);
  if (!loaded || loaded.offer.paymentTerms.length === 0) return;
  const { offer, totals } = loaded;

  const invoicedTerms = new Set(offer.invoices.map((i) => i.paymentTermId).filter(Boolean));
  const projected = projectedPayments(
    offer.paymentTerms.map((t) => ({ id: t.id, amount: Number(t.amount), invoiced: invoicedTerms.has(t.id) })),
    totals.totalTTC,
    loaded.invoiced.totalTTC,
  );
  const count = offer.paymentTerms.length;
  const todo = offer.paymentTerms
    .map((term, index) => ({ term, index, amount: projected.get(term.id) ?? 0 }))
    .filter(({ term, amount }) => !invoicedTerms.has(term.id) && amount > 0 && (termId === null || term.id === termId));
  if (todo.length === 0) return;

  const today = todayUtc();
  const created = await withNumberRetry(() =>
    prisma.$transaction(async (tx) => {
      const running = { ...loaded.invoiced };
      const ids: string[] = [];
      for (const { term, index, amount } of todo) {
        const parts = invoiceVatSplit(amount, totals, running);
        running.totalTTC = round2(running.totalTTC + parts.totalTTC);
        running.totalHT = round2(running.totalHT + parts.totalHT);
        const percent = Number(term.percent);
        const reduced = amount < Number(term.amount);
        const title =
          (count === 1 ? term.label : `Payment ${index + 1} of ${count} – ${term.label} (${percent % 1 ? percent.toFixed(2) : percent}%)`) +
          (reduced ? " – balance after earlier payments" : "");
        const invoice = await tx.invoice.create({
          select: { id: true, number: true },
          data: {
            ...fromOffer(offer),
            companyId,
            number: await nextInvoiceNumber(tx, slug, today.getUTCFullYear()),
            paymentTermId: term.id,
            invoiceDate: today,
            dueDate: new Date(today.getTime() + term.dueDays * 86400000),
            ...parts,
            createdById: user.id,
            lines: {
              create: [{ position: 0, title, description: offerReference(offer), quantity: 1, unitPrice: parts.totalHT, lineTotal: parts.totalHT }],
            },
          },
        });
        await postInvoice(tx, {
          id: invoice.id, companyId, number: invoice.number, invoiceDate: today, customerId: offer.customerId, customerName: offer.customerName,
          totalHT: parts.totalHT, vatAmount: parts.vatAmount, totalTTC: parts.totalTTC, createdById: user.id,
        });
        ids.push(invoice.id);
      }
      if (offer.status !== "ACCEPTED") await tx.offer.update({ where: { id: offer.id }, data: { status: "ACCEPTED" } });
      return ids;
    }, TRANSACTION_OPTIONS),
  );

  updateTag(salesTags.invoices(companyId));
  updateTag(ledgerTag(companyId));
  updateTag(salesTags.offers(companyId));
  redirect(`/c/${slug}/offers/${offer.id}?invoiced=${created.length}`);
}

export type CustomInvoiceState = { error?: string };

const customSchema = z.object({
  offerId: z.string().min(1, "Choose the offer this invoice belongs to"),
  title: z.string().trim().min(2, "Enter a description").max(300),
  amount: z.coerce.number({ message: "Enter an amount" }).positive("The amount must be more than 0"),
  dueDays: z.coerce.number().int().min(0).max(3650).default(0),
  notes: z.string().trim().max(2000).optional(),
  returnTo: z.enum(["offer", "invoice"]).default("invoice"),
});

/**
 * An invoice for any amount against an offer (e.g. the customer pays $50 now), outside the
 * payment schedule. It can't exceed what's left on the offer.
 */
export async function createCustomInvoice(
  companySlug: string,
  _prev: CustomInvoiceState,
  formData: FormData,
): Promise<CustomInvoiceState> {
  const { user, slug } = await requireModule(companySlug, "invoices");
  const parsed = customSchema.safeParse({
    offerId: formData.get("offerId") ?? "",
    title: formData.get("title") ?? "",
    amount: formData.get("amount"),
    dueDays: formData.get("dueDays") || 0,
    notes: formData.get("notes") || undefined,
    returnTo: formData.get("returnTo") || "invoice",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const companyId = await companyIdFor(slug);
  const loaded = await loadOfferForInvoicing(companyId, data.offerId);
  if (!loaded) return { error: "That offer no longer exists." };
  const { offer, totals, invoiced } = loaded;
  const remaining = round2(totals.totalTTC - invoiced.totalTTC);
  const amount = round2(data.amount);
  if (remaining <= 0) return { error: `Offer ${offer.number} is already fully invoiced.` };
  if (amount > remaining) return { error: `Only ${money.format(remaining)} is left to invoice on offer ${offer.number}.` };

  const today = todayUtc();
  const parts = invoiceVatSplit(amount, totals, invoiced);
  const invoiceId = await withNumberRetry(() =>
    prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        select: { id: true, number: true },
        data: {
          ...fromOffer(offer),
          companyId,
          number: await nextInvoiceNumber(tx, slug, today.getUTCFullYear()),
          invoiceDate: today,
          dueDate: new Date(today.getTime() + data.dueDays * 86400000),
          notes: data.notes ?? null,
          ...parts,
          createdById: user.id,
          lines: {
            create: [{ position: 0, title: data.title, description: offerReference(offer), quantity: 1, unitPrice: parts.totalHT, lineTotal: parts.totalHT }],
          },
        },
      });
      await postInvoice(tx, {
        id: invoice.id, companyId, number: invoice.number, invoiceDate: today, customerId: offer.customerId, customerName: offer.customerName,
        totalHT: parts.totalHT, vatAmount: parts.vatAmount, totalTTC: parts.totalTTC, createdById: user.id,
      });
      if (offer.status !== "ACCEPTED") await tx.offer.update({ where: { id: offer.id }, data: { status: "ACCEPTED" } });
      return invoice.id;
    }, TRANSACTION_OPTIONS),
  );

  updateTag(salesTags.invoices(companyId));
  updateTag(ledgerTag(companyId));
  updateTag(salesTags.offers(companyId));
  redirect(data.returnTo === "offer" ? `/c/${slug}/offers/${offer.id}?invoiced=1` : `/c/${slug}/invoices/${invoiceId}`);
}

/**
 * Cancel an invoice (final: frees its payment so it can be invoiced again). Posts a reversal
 * entry. Refused while payments or credit notes are recorded against it.
 */
export async function cancelInvoice(companySlug: string, invoiceId: string): Promise<{ error?: string }> {
  const { user, slug } = await requireModule(companySlug, "invoices");
  const companyId = await companyIdFor(slug);
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: {
      number: true,
      status: true,
      _count: { select: { receipts: true, creditNotes: { where: { status: "ISSUED" } } } },
    },
  });
  if (!invoice) return { error: "This invoice no longer exists." };
  if (invoice.status === "CANCELLED") return {};
  if (invoice._count.receipts > 0) return { error: "Payments are recorded on this invoice. Delete them first, or issue a credit note instead." };
  if (invoice._count.creditNotes > 0) return { error: "Credit notes are issued on this invoice. Cancel them first." };

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED", paidAt: null } });
    await reverseEntries(tx, "INVOICE", invoiceId, todayUtc(), user.id, `Invoice ${invoice.number} cancelled`);
  }, TRANSACTION_OPTIONS);
  updateTag(salesTags.invoices(companyId));
  updateTag(ledgerTag(companyId));
  updateTag(salesTags.offers(companyId));
  updateTag(payablesTag(companyId));
  return {};
}

