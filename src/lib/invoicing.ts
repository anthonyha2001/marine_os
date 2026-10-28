import "server-only";
import { nextInvoiceNumber } from "@/lib/invoice-numbers";
import { postInvoice } from "@/lib/ledger/posting";
import { VAT_RATE, round2 } from "@/lib/money";
import type { Tx } from "@/lib/prisma";
import type { CompanySlug } from "@/lib/permissions";

export type InvoiceLineInput = { title: string; description?: string | null; quantity: number; unitPrice: number };

/** Totals for free invoice lines: line amounts excl. VAT, then 11% VAT if applied. */
export function linesTotals(lines: InvoiceLineInput[], applyVat: boolean) {
  const rows = lines.map((l, position) => ({
    position,
    title: l.title,
    description: l.description ?? null,
    quantity: l.quantity,
    unitPrice: round2(l.unitPrice),
    lineTotal: round2(l.quantity * l.unitPrice),
  }));
  const totalHT = round2(rows.reduce((s, r) => s + r.lineTotal, 0));
  const vatAmount = applyVat ? round2(totalHT * VAT_RATE) : 0;
  return { rows, totalHT, vatAmount, totalTTC: round2(totalHT + vatAmount) };
}

/**
 * Create an invoice from free lines (custom invoice or job card) and post it to the ledger,
 * inside the caller's transaction. Offer invoices keep their own path (payment schedule).
 */
export async function createInvoiceWithLines(
  tx: Tx,
  input: {
    slug: CompanySlug;
    companyId: string;
    createdById: string;
    invoiceDate: Date;
    dueDate: Date;
    customer: { id: string | null; name: string; address?: string | null; email?: string | null; phone?: string | null; taxNumber?: string | null; attention?: string | null };
    subject?: string | null;
    reference?: string | null;
    notes?: string | null;
    applyVat: boolean;
    lines: InvoiceLineInput[];
    vesselId?: string | null;
    jobCardId?: string | null;
  },
) {
  const t = linesTotals(input.lines, input.applyVat);
  const invoice = await tx.invoice.create({
    select: { id: true, number: true },
    data: {
      companyId: input.companyId,
      number: await nextInvoiceNumber(tx, input.slug, input.invoiceDate.getUTCFullYear()),
      customerId: input.customer.id,
      customerName: input.customer.name,
      customerAttention: input.customer.attention ?? null,
      customerAddress: input.customer.address ?? null,
      customerEmail: input.customer.email ?? null,
      customerPhone: input.customer.phone ?? null,
      customerTaxNumber: input.customer.taxNumber ?? null,
      subject: input.subject ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      applyVat: input.applyVat,
      totalHT: t.totalHT,
      vatAmount: t.vatAmount,
      totalTTC: t.totalTTC,
      vesselId: input.vesselId ?? null,
      jobCardId: input.jobCardId ?? null,
      createdById: input.createdById,
      lines: { create: t.rows },
    },
  });
  await postInvoice(tx, {
    id: invoice.id,
    companyId: input.companyId,
    number: invoice.number,
    invoiceDate: input.invoiceDate,
    customerId: input.customer.id,
    customerName: input.customer.name,
    totalHT: t.totalHT,
    vatAmount: t.vatAmount,
    totalTTC: t.totalTTC,
    createdById: input.createdById,
  });
  return { ...invoice, ...t };
}
