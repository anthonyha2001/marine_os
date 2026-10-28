"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { isPaymentMethod } from "@/lib/accounting";
import { payablesTag } from "@/lib/data/accounting";
import { companyIdFor, tags } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { postSupplierPayment, removeEntries } from "@/lib/ledger/posting";
import { round2 } from "@/lib/money";

export type PaymentFormState = { error?: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const paymentSchema = z.object({
  amount: z.coerce.number({ message: "Enter an amount" }).positive("The amount must be more than 0"),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the payment date"),
  method: z.string().refine(isPaymentMethod, "Choose how it was paid"),
  moneyAccountId: z.string().min(1, "Choose the cash box or bank account it was paid from"),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  returnTo: z.enum(["accounting", "purchase"]).default("accounting"),
});

/** Record a (possibly partial) payment to a supplier against a purchase, and post it. */
export async function recordSupplierPayment(
  companySlug: string,
  purchaseId: string,
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const { user, slug } = await requireModule(companySlug, "accounting");
  const parsed = paymentSchema.safeParse({
    amount: formData.get("amount"),
    paidAt: formData.get("paidAt") ?? "",
    method: formData.get("method") ?? "",
    moneyAccountId: formData.get("moneyAccountId") ?? "",
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
    returnTo: formData.get("returnTo") || "accounting",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const companyId = await companyIdFor(slug);
  const [purchase, account] = await Promise.all([
    prisma.purchase.findFirst({
      where: { id: purchaseId, companyId },
      select: { invoiceNumber: true, supplierId: true, supplier: { select: { name: true } }, totalTTC: true, payments: { select: { amount: true } } },
    }),
    prisma.ledgerAccount.findFirst({ where: { id: data.moneyAccountId, companyId, kind: { in: ["CASH", "BANK"] }, active: true }, select: { id: true } }),
  ]);
  if (!purchase) return { error: "This purchase no longer exists." };
  if (!account) return { error: "Choose a cash box or bank account of this company." };
  const balance = round2(Number(purchase.totalTTC) - purchase.payments.reduce((s, p) => s + Number(p.amount), 0));
  const amount = round2(data.amount);
  if (balance <= 0) return { error: "This bill is already fully paid." };
  if (amount > balance) return { error: `Only ${money.format(balance)} is left to pay on this bill.` };

  const paidAt = new Date(`${data.paidAt}T00:00:00Z`);
  await prisma.$transaction(async (tx) => {
    const payment = await tx.supplierPayment.create({
      select: { id: true },
      data: {
        companyId,
        purchaseId,
        amount,
        paidAt,
        method: data.method,
        moneyAccountId: account.id,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
        createdById: user.id,
      },
    });
    await postSupplierPayment(tx, {
      id: payment.id,
      companyId,
      amount,
      paidAt,
      moneyAccountId: account.id,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier.name,
      invoiceNumber: purchase.invoiceNumber,
      createdById: user.id,
    });
  }, TRANSACTION_OPTIONS);

  updateTag(payablesTag(companyId));
  updateTag(ledgerTag(companyId));
  redirect(data.returnTo === "purchase" ? `/c/${slug}/purchases/${purchaseId}?paid=1` : `/c/${slug}/accounting?paid=1`);
}

/** Remove a payment recorded by mistake (and its journal entry). */
export async function deleteSupplierPayment(companySlug: string, paymentId: string): Promise<{ error?: string }> {
  const { slug } = await requireModule(companySlug, "accounting");
  const companyId = await companyIdFor(slug);
  const payment = await prisma.supplierPayment.findFirst({ where: { id: paymentId, companyId }, select: { id: true } });
  if (!payment) return { error: "This payment no longer exists." };
  if (await prisma.cheque.count({ where: { supplierPaymentId: paymentId } })) return { error: "This payment is a cheque. On the Cheques page, mark it as bounced or cancelled instead." };
  await prisma.$transaction(async (tx) => {
    await removeEntries(tx, "SUPPLIER_PAYMENT", paymentId);
    await tx.supplierPayment.delete({ where: { id: paymentId } });
  }, TRANSACTION_OPTIONS);
  updateTag(payablesTag(companyId));
  updateTag(ledgerTag(companyId));
  updateTag(tags.purchases(companyId));
  return {};
}
