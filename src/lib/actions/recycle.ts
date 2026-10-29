"use server";

import bcrypt from "bcryptjs";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { DATA_TAG } from "@/lib/cache-tag";
import { companyIdFor } from "@/lib/data/inventory";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import { refreshInvoiceStatus } from "@/lib/ledger/invoice-status";
import { isAdmin } from "@/lib/permissions";
import { RestoreError, restoreFromBin } from "@/lib/recycle-bin";

type Result = { error?: string };

async function binItem(companySlug: string, itemId: string) {
  const { user, slug } = await requireModule(companySlug, "recycleBin");
  const companyId = await companyIdFor(slug);
  const item = await prisma.recycleBinItem.findFirst({ where: { id: itemId, OR: [{ companyId }, { companyId: null }] }, select: { id: true } });
  return { user, item };
}

/** Put a deleted record back, with its lines, stock movements and journal entries. */
export async function restoreBinItem(companySlug: string, itemId: string): Promise<Result> {
  const { user, item } = await binItem(companySlug, itemId);
  if (!item) return { error: "This item is no longer in the recycle bin." };
  try {
    await prisma.$transaction(async (tx) => {
      const restored = await restoreFromBin(tx, item.id, user.name);
      // Receipts change what is still owed on their invoice.
      const rows = restored.rows as unknown as Record<string, { invoiceId?: string | null }[]>;
      for (const r of rows.CustomerReceipt ?? []) if (r.invoiceId) await refreshInvoiceStatus(tx, r.invoiceId);
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e instanceof RestoreError) return { error: e.message };
    throw e;
  }
  updateTag(DATA_TAG);
  return {};
}

/** Remove an item from the recycle bin for good (admin only). */
export async function purgeBinItem(companySlug: string, itemId: string): Promise<Result> {
  const { user, item } = await binItem(companySlug, itemId);
  if (!isAdmin(user)) return { error: "Only the admin can delete for good." };
  if (!item) return {};
  await prisma.recycleBinItem.delete({ where: { id: item.id } });
  updateTag(DATA_TAG);
  return {};
}

export type EmptyState = { error?: string };

/** Kept when the database is emptied: the companies, logins, chart of accounts and settings. */
const KEEP = new Set(["Company", "User", "LedgerAccount", "PayrollSettings", "PosSettings", "OfferClause", "ExchangeRate", "_prisma_migrations"]);

/**
 * Empty all business data of both companies (admin only, with the admin's password and the word
 * EMPTY). Companies, logins, chart of accounts and settings stay. This can't be undone.
 */
export async function emptyDatabase(companySlug: string, _prev: EmptyState, formData: FormData): Promise<EmptyState> {
  const { user, slug } = await requireModule(companySlug, "recycleBin");
  if (!isAdmin(user)) return { error: "Only the admin can empty the database." };
  if (String(formData.get("confirm") ?? "").trim() !== "EMPTY") return { error: "Type EMPTY in capital letters to confirm." };
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!me || !(await bcrypt.compare(String(formData.get("password") ?? ""), me.passwordHash))) return { error: "The password is not correct." };

  const tables = (await prisma.$queryRaw<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public'`)
    .map((t) => t.tablename)
    .filter((t) => !KEEP.has(t));
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTRICT`);
  await prisma.auditLog.create({ data: { userId: user.id, userName: user.name, action: "DELETE", entity: "Database", label: "Emptied all business data of both companies" } });
  updateTag(DATA_TAG);
  redirect(`/c/${slug}/dashboard?emptied=1`);
}
