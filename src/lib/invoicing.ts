import "server-only";
import { nextInvoiceNumber } from "@/lib/invoice-numbers";
import { postInvoice } from "@/lib/ledger/posting";
import { VAT_RATE, round2 } from "@/lib/money";
import type { Tx } from "@/lib/prisma";
import { currentLbpRate } from "@/lib/lbp-rate";
import type { CompanySlug } from "@/lib/permissions";

/**
 * moveStock: the line takes the product out of stock when the invoice is issued. Off for lines
 * whose stock leaves elsewhere (a job card when it is marked Done).
 */
export type InvoiceLineInput = { productId?: string | null; moveStock?: boolean; title: string; description?: string | null; quantity: number; unitPrice: number; discountPercent?: number };

/** Totals for free invoice lines: line amounts excl. VAT after each line's discount, then 11% VAT if applied. */
export function linesTotals(lines: InvoiceLineInput[], applyVat: boolean) {
  const rows = lines.map((l, position) => ({
    position,
    productId: l.productId ?? null,
    title: l.title,
    description: l.description ?? null,
    quantity: l.quantity,
    unitPrice: round2(l.unitPrice),
    discountPercent: Math.min(Math.max(l.discountPercent ?? 0, 0), 100),
    lineTotal: round2(l.quantity * l.unitPrice * (1 - Math.min(Math.max(l.discountPercent ?? 0, 0), 100) / 100)),
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
    offerId?: string | null;
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
      lbpRate: await currentLbpRate(tx, input.companyId),
      totalHT: t.totalHT,
      vatAmount: t.vatAmount,
      totalTTC: t.totalTTC,
      vesselId: input.vesselId ?? null,
      jobCardId: input.jobCardId ?? null,
      offerId: input.offerId ?? null,
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
  await invoiceStockOut(tx, input.companyId, invoice.id, input.lines);
  return { ...invoice, ...t };
}

/** Products sold on an invoice leave the stock (services and lines without moveStock don't). */
async function invoiceStockOut(tx: Tx, companyId: string, invoiceId: string, lines: InvoiceLineInput[]) {
  const moving = lines.filter((l) => l.moveStock && l.productId && l.quantity > 0);
  if (!moving.length) return;
  const products = await tx.product.findMany({ where: { id: { in: moving.map((l) => l.productId!) }, type: "PRODUCT" }, select: { id: true } });
  const stocked = new Set(products.map((p) => p.id));
  const moves = moving.filter((l) => stocked.has(l.productId!));
  if (moves.length) {
    await tx.stockMovement.createMany({
      data: moves.map((l) => ({ companyId, productId: l.productId!, quantity: -Math.round(l.quantity), type: "INVOICE", invoiceId })),
    });
  }
}

/** A cancelled invoice puts back what it took out of stock (a reversing movement keeps the history). */
export async function invoiceStockBack(tx: Tx, invoiceId: string) {
  const moves = await tx.stockMovement.findMany({ where: { invoiceId }, select: { companyId: true, productId: true, quantity: true } });
  const net = new Map<string, { companyId: string; quantity: number }>();
  for (const m of moves) {
    const row = net.get(m.productId) ?? { companyId: m.companyId, quantity: 0 };
    row.quantity += m.quantity;
    net.set(m.productId, row);
  }
  const back = [...net].filter(([, r]) => r.quantity < 0);
  if (back.length) {
    await tx.stockMovement.createMany({
      data: back.map(([productId, r]) => ({ companyId: r.companyId, productId, quantity: -r.quantity, type: "INVOICE_CANCEL", invoiceId })),
    });
  }
}
