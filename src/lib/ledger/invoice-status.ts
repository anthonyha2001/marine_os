import "server-only";
import type { Tx } from "@/lib/prisma";
import { round2 } from "@/lib/money";

/**
 * What is still owed on an invoice: its total, minus customer receipts, minus issued credit notes.
 * Paid status follows automatically (and goes back to unpaid if a receipt is deleted).
 */
export async function refreshInvoiceStatus(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      status: true,
      totalTTC: true,
      receipts: { where: { status: "POSTED" }, select: { amount: true, receivedAt: true } },
      creditNotes: { where: { status: "ISSUED" }, select: { totalTTC: true } },
    },
  });
  if (!inv || inv.status === "CANCELLED") return null;
  const paid = round2(inv.receipts.reduce((s, r) => s + Number(r.amount), 0));
  const credited = round2(inv.creditNotes.reduce((s, c) => s + Number(c.totalTTC), 0));
  const balance = round2(Number(inv.totalTTC) - paid - credited);
  const status = balance <= 0.005 ? "PAID" : "ISSUED";
  const lastReceipt = inv.receipts.map((r) => r.receivedAt).sort((a, b) => b.getTime() - a.getTime())[0];
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { status, paidAt: status === "PAID" ? (lastReceipt ?? new Date()) : null },
  });
  return { paid, credited, balance };
}

/** Balance still owed on an invoice (no status change). */
export async function invoiceBalance(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      totalTTC: true,
      status: true,
      receipts: { where: { status: "POSTED" }, select: { amount: true } },
      creditNotes: { where: { status: "ISSUED" }, select: { totalTTC: true } },
    },
  });
  if (!inv) return null;
  const paid = round2(inv.receipts.reduce((s, r) => s + Number(r.amount), 0));
  const credited = round2(inv.creditNotes.reduce((s, c) => s + Number(c.totalTTC), 0));
  return { total: Number(inv.totalTTC), paid, credited, balance: round2(Number(inv.totalTTC) - paid - credited), status: inv.status };
}
