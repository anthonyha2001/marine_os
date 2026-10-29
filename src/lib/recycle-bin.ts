import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/prisma";

// Soft delete for the whole system. Before a record is deleted, it is copied to the recycle bin
// with every row removed with it: rows linked by a cascading foreign key (lines, stock movements,
// payment terms…), the journal entries posted for any of them (linked by sourceId), and the links
// that the delete empties (SetNull). Restoring inserts the rows back, parents first.

type Row = Record<string, unknown>;
type Rows = Record<string, Row[]>;
type Relink = { model: string; id: string; field: string; value: unknown };
type Db = Tx | typeof prisma;

const models = Prisma.dmmf.datamodel.models;
const delegate = (db: Db, model: string) =>
  (db as unknown as Record<string, { findMany: (a: unknown) => Promise<Row[]>; createMany: (a: unknown) => Promise<unknown>; updateMany: (a: unknown) => Promise<unknown> }>)[
    model[0].toLowerCase() + model.slice(1)
  ];

/** Foreign keys in other models that point at this one and follow it on delete. */
function linksTo(model: string) {
  return models.flatMap((m) =>
    m.fields
      .filter((f) => f.kind === "object" && f.type === model && f.relationFromFields?.length === 1 && (f.relationOnDelete === "Cascade" || f.relationOnDelete === "SetNull"))
      .map((f) => ({ model: m.name, field: f.relationFromFields![0], cascade: f.relationOnDelete === "Cascade" })),
  );
}

async function collect(db: Db, model: string, ids: string[], rows: Rows, relinks: Relink[], seen: Set<string>) {
  const fresh = ids.filter((id) => !seen.has(`${model}:${id}`));
  if (!fresh.length) return;
  fresh.forEach((id) => seen.add(`${model}:${id}`));
  (rows[model] ??= []).push(...(await delegate(db, model).findMany({ where: { id: { in: fresh } } })));
  for (const link of linksTo(model)) {
    const kids = await delegate(db, link.model).findMany({ where: { [link.field]: { in: fresh } }, select: { id: true, [link.field]: true } });
    if (!kids.length) continue;
    if (link.cascade) await collect(db, link.model, kids.map((k) => String(k.id)), rows, relinks, seen);
    else relinks.push(...kids.map((k) => ({ model: link.model, id: String(k.id), field: link.field, value: k[link.field] })));
  }
}

/**
 * Copy a record (and everything its delete removes) to the recycle bin. Call it inside the same
 * transaction, just before the delete.
 */
export async function toRecycleBin(db: Db, item: { model: string; id: string; companyId: string | null; label: string; deletedByName: string }) {
  const rows: Rows = {};
  const relinks: Relink[] = [];
  const seen = new Set<string>();
  await collect(db, item.model, [item.id], rows, relinks, seen);
  // Journal entries posted for any of these records (their lines follow by cascade).
  const ids = Object.values(rows).flatMap((list) => list.map((r) => String(r.id)));
  const entries = await delegate(db, "JournalEntry").findMany({ where: { sourceId: { in: ids } }, select: { id: true } });
  if (entries.length) await collect(db, "JournalEntry", entries.map((e) => String(e.id)), rows, relinks, seen);
  await (db as Tx).recycleBinItem.create({
    data: {
      companyId: item.companyId,
      entity: item.model,
      entityId: item.id,
      label: item.label,
      rows: JSON.parse(JSON.stringify(rows)),
      relinks: relinks.length ? JSON.parse(JSON.stringify(relinks)) : Prisma.DbNull,
      deletedByName: item.deletedByName,
    },
  });
}

/** Models in an order where every parent comes before the rows that point to it. */
function parentsFirst(names: string[]) {
  const deps = new Map(models.map((m) => [m.name, m.fields.filter((f) => f.relationFromFields?.length && f.type !== m.name).map((f) => f.type)]));
  const order: string[] = [];
  const pending = [...names];
  while (pending.length) {
    const i = pending.findIndex((n) => (deps.get(n) ?? []).every((d) => !pending.includes(d) || d === n));
    order.push(...pending.splice(i < 0 ? 0 : i, 1));
  }
  return order;
}

/** JSON keeps dates and decimals as text, which Prisma accepts; empty JSON columns need DbNull. */
function revive(model: string, row: Row) {
  const json = models.find((m) => m.name === model)!.fields.filter((f) => f.type === "Json").map((f) => f.name);
  const out = { ...row };
  for (const f of json) if (out[f] === null) out[f] = Prisma.DbNull;
  return out;
}

export class RestoreError extends Error {}

/** Put a deleted record back exactly as it was (same numbers, lines and journal entries). */
export async function restoreFromBin(tx: Tx, itemId: string, restoredByName: string) {
  const item = await tx.recycleBinItem.findUnique({ where: { id: itemId } });
  if (!item || item.restoredAt) throw new RestoreError("This item was already restored or no longer exists.");
  const rows = item.rows as unknown as Rows;
  try {
    for (const model of parentsFirst(Object.keys(rows))) {
      if (rows[model].length) await delegate(tx, model).createMany({ data: rows[model].map((r) => revive(model, r)) });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new RestoreError("It can't be restored: a newer record already uses the same number or code.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003")
      throw new RestoreError("It can't be restored: something it belongs to (customer, product, account…) was deleted too. Restore that first.");
    throw e;
  }
  for (const r of (item.relinks as unknown as Relink[] | null) ?? []) {
    await delegate(tx, r.model).updateMany({ where: { id: r.id, [r.field]: null }, data: { [r.field]: r.value } });
  }
  await tx.recycleBinItem.update({ where: { id: item.id }, data: { restoredAt: new Date(), restoredByName } });
  return item;
}
