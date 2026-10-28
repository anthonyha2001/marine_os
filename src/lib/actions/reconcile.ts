"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { ledgerTag } from "@/lib/data/ledger";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { round2 } from "@/lib/money";

export type ReconcileState = { error?: string };

const schema = z.object({
  accountId: z.string().min(1),
  statementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the statement date"),
  statementBalance: z.number({ message: "Enter the statement's closing balance" }),
  lineIds: z.array(z.string()),
});

/** Balance of the lines already matched with a statement (debit − credit). */
async function reconciledBalance(accountId: string) {
  const r = await prisma.journalLine.aggregate({ where: { accountId, reconciliationId: { not: null } }, _sum: { debit: true, credit: true } });
  return round2(Number(r._sum.debit ?? 0) - Number(r._sum.credit ?? 0));
}

/** Save a reconciliation: the ticked lines are the ones on the bank statement. Must balance to zero. */
export async function finishReconciliation(companySlug: string, _prev: ReconcileState, formData: FormData): Promise<ReconcileState> {
  const { user, slug } = await requireModule(companySlug, "accounting");
  const companyId = await companyIdFor(slug);
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const account = await prisma.ledgerAccount.findFirst({ where: { id: d.accountId, companyId, kind: "BANK" }, select: { id: true } });
  if (!account) return { error: "Choose a bank account of this company." };
  const lines = await prisma.journalLine.findMany({
    where: { id: { in: d.lineIds }, accountId: account.id, reconciliationId: null, entry: { date: { lte: new Date(`${d.statementDate}T23:59:59Z`) } } },
    select: { id: true, debit: true, credit: true },
  });
  if (lines.length !== d.lineIds.length) return { error: "Some ticked lines were already reconciled or are after the statement date. Reload the page." };
  const cleared = round2((await reconciledBalance(account.id)) + lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
  const diff = round2(d.statementBalance - cleared);
  if (Math.abs(diff) >= 0.005) return { error: `Not balanced yet: a difference of ${diff.toFixed(2)} remains. Tick the missing lines, or record bank charges / interest first.` };

  await prisma.$transaction(async (tx) => {
    const rec = await tx.bankReconciliation.create({
      select: { id: true },
      data: { companyId, accountId: account.id, statementDate: new Date(`${d.statementDate}T00:00:00Z`), statementBalance: d.statementBalance, createdById: user.id },
    });
    await tx.journalLine.updateMany({ where: { id: { in: lines.map((l) => l.id) } }, data: { reconciliationId: rec.id } });
  }, TRANSACTION_OPTIONS);
  updateTag(ledgerTag(companyId));
  redirect(`/c/${slug}/finance/reconcile?account=${account.id}&done=1`);
}

/** Undo the latest reconciliation of an account (its lines become unmatched again). */
export async function undoReconciliation(companySlug: string, reconciliationId: string): Promise<{ error?: string }> {
  const { slug } = await requireModule(companySlug, "accounting");
  const companyId = await companyIdFor(slug);
  const rec = await prisma.bankReconciliation.findFirst({ where: { id: reconciliationId, companyId }, select: { id: true, accountId: true, createdAt: true } });
  if (!rec) return { error: "This reconciliation no longer exists." };
  const later = await prisma.bankReconciliation.count({ where: { accountId: rec.accountId, createdAt: { gt: rec.createdAt } } });
  if (later) return { error: "Undo the more recent reconciliations first." };
  await prisma.$transaction(async (tx) => {
    await tx.journalLine.updateMany({ where: { reconciliationId: rec.id }, data: { reconciliationId: null } });
    await tx.bankReconciliation.delete({ where: { id: rec.id } });
  }, TRANSACTION_OPTIONS);
  updateTag(ledgerTag(companyId));
  return {};
}
