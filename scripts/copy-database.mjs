// Copy every row from one Marine OS database to another (e.g. Sydney → Frankfurt).
//
//   SOURCE_URL=postgresql://... TARGET_URL=postgresql://... node scripts/copy-database.mjs [--dry-run]
//
// The target must already have the schema (run `prisma migrate deploy` against it first) and be
// empty. Tables are copied parents first, then row counts are compared table by table.
import { Prisma, PrismaClient } from "@prisma/client";

const { SOURCE_URL, TARGET_URL } = process.env;
const dryRun = process.argv.includes("--dry-run");
if (!SOURCE_URL || (!dryRun && !TARGET_URL)) {
  console.error("Set SOURCE_URL and TARGET_URL (use the session pooler or direct URLs).");
  process.exit(1);
}

const models = Prisma.dmmf.datamodel.models;
const delegate = (name) => name[0].toLowerCase() + name.slice(1);

// Parents before children: a model waits for every model its foreign keys point to.
function copyOrder() {
  const deps = new Map(models.map((m) => [m.name, new Set(m.fields.filter((f) => f.relationFromFields?.length && f.type !== m.name).map((f) => f.type))]));
  const order = [];
  while (order.length < models.length) {
    const ready = models.filter((m) => !order.includes(m.name) && [...deps.get(m.name)].every((d) => order.includes(d)));
    if (!ready.length) throw new Error("Circular foreign keys between: " + models.filter((m) => !order.includes(m.name)).map((m) => m.name).join(", "));
    order.push(...ready.map((m) => m.name));
  }
  return order;
}

const source = new PrismaClient({ datasourceUrl: SOURCE_URL });
const target = dryRun ? null : new PrismaClient({ datasourceUrl: TARGET_URL });

try {
  const order = copyOrder();
  if (target) {
    for (const name of order) {
      if ((await target[delegate(name)].count()) > 0) throw new Error(`Target table ${name} is not empty. Use an empty database.`);
    }
  }
  for (const name of order) {
    const rows = await source[delegate(name)].findMany();
    if (target && rows.length) {
      for (let i = 0; i < rows.length; i += 500) await target[delegate(name)].createMany({ data: rows.slice(i, i + 500) });
    }
    const copied = target ? await target[delegate(name)].count() : rows.length;
    const ok = copied === rows.length;
    console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(20)} ${rows.length} rows${target ? ` → ${copied}` : ""}`);
    if (!ok) process.exitCode = 1;
  }
  console.log(dryRun ? "Dry run: nothing written." : process.exitCode ? "Copy finished WITH DIFFERENCES." : "Copy finished: every table matches.");
} finally {
  await source.$disconnect();
  await target?.$disconnect();
}
