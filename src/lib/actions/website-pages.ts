"use server";

import { updateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { websiteTag } from "@/lib/data/website";
import { prisma } from "@/lib/prisma";
import { BLOCKS, RESERVED_SLUGS, STARTER_PAGES, isBlockType, type BlockData, type BlockType, type Field } from "@/lib/website-blocks";
import { readTheme } from "@/lib/website-theme";

// Marketing → Website → Pages and Design. Every change refreshes the public site.

type Result = { error?: string; id?: string };

async function ctx(companySlug: string) {
  const { user, slug } = await requireModule(companySlug, "marketing");
  return { user, slug, companyId: await companyIdFor(slug) };
}
const done = (companyId: string) => updateTag(websiteTag(companyId));

/** The first edit saves the starter pages as the company's own. */
async function ensurePages(companyId: string) {
  if (await prisma.websitePage.count({ where: { companyId } })) return;
  await prisma.$transaction(
    STARTER_PAGES.map((p, i) =>
      prisma.websitePage.create({
        data: { companyId, slug: p.slug, title: p.title, inNav: p.inNav, position: i, blocks: { create: p.blocks.map((b, j) => ({ type: b.type, position: j, data: b.data as Prisma.InputJsonValue })) } },
      }),
    ),
  );
}

/** Ids shown before the pages were saved ("starter-…") point to the saved rows. */
async function pageId(companyId: string, id: string) {
  await ensurePages(companyId);
  if (!id.startsWith("starter-")) return (await prisma.websitePage.findFirst({ where: { id, companyId }, select: { id: true } }))?.id ?? null;
  const slug = id.slice("starter-".length);
  return (await prisma.websitePage.findFirst({ where: { companyId, slug: slug === "home" ? "" : slug }, select: { id: true } }))?.id ?? null;
}
async function blockRow(companyId: string, id: string) {
  await ensurePages(companyId);
  if (id.startsWith("starter-")) {
    const [, key, index] = id.match(/^starter-(.+)-(\d+)$/) ?? [];
    const page = await prisma.websitePage.findFirst({ where: { companyId, slug: key === "home" ? "" : key }, select: { id: true } });
    if (!page) return null;
    return prisma.websiteBlock.findFirst({ where: { pageId: page.id }, orderBy: { position: "asc" }, skip: Number(index) });
  }
  return prisma.websiteBlock.findFirst({ where: { id, page: { companyId } } });
}

// ---- Block data: only the block's own fields, cleaned up
const clean = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
function cleanField(f: Exclude<Field, { type: "list" }>, v: unknown): unknown {
  if (f.type === "toggle") return v === true;
  if (f.type === "number") return Number.isFinite(Number(v)) && v !== "" && v !== null ? Math.max(-1e9, Math.min(1e9, Number(v))) : null;
  if (f.type === "select") return f.options.some(([o]) => o === v) ? v : f.options[0][0];
  if (f.type === "image") return typeof v === "string" && /^[a-z0-9]{10,40}$/i.test(v) ? v : null;
  if (f.type === "url" || f.type === "video") return clean(v, 500).trim();
  return clean(v);
}
function cleanData(type: BlockType, raw: unknown): BlockData {
  const src = (raw && typeof raw === "object" ? raw : {}) as BlockData;
  const out: BlockData = {};
  for (const f of BLOCKS[type].fields as Field[]) {
    if (f.type === "list") {
      const rows = Array.isArray(src[f.key]) ? (src[f.key] as BlockData[]).slice(0, f.max ?? 50) : [];
      out[f.key] = rows.map((row) => Object.fromEntries(f.item.map((sub) => [sub.key, cleanField(sub, row?.[sub.key])])));
    } else out[f.key] = cleanField(f, src[f.key]);
  }
  return out;
}

// ---- Blocks
export async function saveBlock(companySlug: string, blockId: string, data: unknown): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const block = await blockRow(companyId, blockId);
  if (!block || !isBlockType(block.type)) return { error: "This block no longer exists." };
  await prisma.websiteBlock.update({ where: { id: block.id }, data: { data: cleanData(block.type, data) as Prisma.InputJsonValue } });
  done(companyId);
  return { id: block.id };
}

export async function addBlock(companySlug: string, pageRef: string, type: string, afterBlockId: string | null): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  if (!isBlockType(type)) return { error: "Unknown block." };
  const pid = await pageId(companyId, pageRef);
  if (!pid) return { error: "This page no longer exists." };
  const after = afterBlockId ? await blockRow(companyId, afterBlockId) : null;
  const position = after ? after.position + 1 : ((await prisma.websiteBlock.aggregate({ where: { pageId: pid }, _max: { position: true } }))._max.position ?? -1) + 1;
  const created = await prisma.$transaction(async (tx) => {
    await tx.websiteBlock.updateMany({ where: { pageId: pid, position: { gte: position } }, data: { position: { increment: 1 } } });
    return tx.websiteBlock.create({ data: { pageId: pid, type, position, data: BLOCKS[type].defaults as Prisma.InputJsonValue }, select: { id: true } });
  });
  done(companyId);
  return { id: created.id };
}

export async function moveBlock(companySlug: string, blockId: string, direction: -1 | 1): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const block = await blockRow(companyId, blockId);
  if (!block) return { error: "This block no longer exists." };
  const blocks = await prisma.websiteBlock.findMany({ where: { pageId: block.pageId }, orderBy: { position: "asc" }, select: { id: true } });
  const at = blocks.findIndex((b) => b.id === block.id);
  const to = at + direction;
  if (to < 0 || to >= blocks.length) return { id: block.id };
  [blocks[at], blocks[to]] = [blocks[to], blocks[at]];
  await prisma.$transaction(blocks.map((b, i) => prisma.websiteBlock.update({ where: { id: b.id }, data: { position: i } })));
  done(companyId);
  return { id: block.id };
}

export async function setBlockHidden(companySlug: string, blockId: string, hidden: boolean): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const block = await blockRow(companyId, blockId);
  if (!block) return { error: "This block no longer exists." };
  await prisma.websiteBlock.update({ where: { id: block.id }, data: { hidden } });
  done(companyId);
  return { id: block.id };
}

export async function duplicateBlock(companySlug: string, blockId: string): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const block = await blockRow(companyId, blockId);
  if (!block) return { error: "This block no longer exists." };
  const copy = await prisma.$transaction(async (tx) => {
    await tx.websiteBlock.updateMany({ where: { pageId: block.pageId, position: { gt: block.position } }, data: { position: { increment: 1 } } });
    return tx.websiteBlock.create({ data: { pageId: block.pageId, type: block.type, position: block.position + 1, hidden: block.hidden, data: block.data as Prisma.InputJsonValue }, select: { id: true } });
  });
  done(companyId);
  return { id: copy.id };
}

export async function deleteBlock(companySlug: string, blockId: string): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const block = await blockRow(companyId, blockId);
  if (!block) return { error: "This block no longer exists." };
  await prisma.websiteBlock.delete({ where: { id: block.id } });
  done(companyId);
  return {};
}

// ---- Pages
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

export async function addPage(companySlug: string, title: string): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const name = title.trim().slice(0, 80);
  if (name.length < 2) return { error: "Give the page a name." };
  await ensurePages(companyId);
  const slug = slugify(name);
  if (!slug || RESERVED_SLUGS.includes(slug)) return { error: "Choose another name for this page." };
  if (await prisma.websitePage.findFirst({ where: { companyId, slug } })) return { error: `There is already a page at /${slug}.` };
  const position = ((await prisma.websitePage.aggregate({ where: { companyId }, _max: { position: true } }))._max.position ?? -1) + 1;
  const page = await prisma.websitePage.create({
    data: { companyId, slug, title: name, position, blocks: { create: [{ type: "hero", position: 0, data: { size: "page", title: name, waves: true } }] } },
    select: { id: true },
  });
  done(companyId);
  return { id: page.id };
}

export async function savePageSettings(
  companySlug: string,
  ref: string,
  values: { title: string; slug: string; inNav: boolean; published: boolean; seoTitle: string; seoDescription: string },
): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const id = await pageId(companyId, ref);
  if (!id) return { error: "This page no longer exists." };
  const page = await prisma.websitePage.findUniqueOrThrow({ where: { id } });
  const title = values.title.trim().slice(0, 80);
  if (title.length < 2) return { error: "Give the page a name." };
  // The home page keeps its address; others can be renamed.
  const slug = page.slug === "" ? "" : slugify(values.slug || title);
  if (page.slug !== "" && (!slug || RESERVED_SLUGS.includes(slug))) return { error: "Choose another address for this page." };
  if (slug !== page.slug && (await prisma.websitePage.findFirst({ where: { companyId, slug } }))) return { error: `There is already a page at /${slug}.` };
  await prisma.websitePage.update({
    where: { id },
    data: { title, slug, inNav: values.inNav, published: page.slug === "" ? true : values.published, seoTitle: values.seoTitle.trim().slice(0, 120) || null, seoDescription: values.seoDescription.trim().slice(0, 300) || null },
  });
  done(companyId);
  return { id };
}

export async function movePage(companySlug: string, ref: string, direction: -1 | 1): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const id = await pageId(companyId, ref);
  if (!id) return { error: "This page no longer exists." };
  const pages = await prisma.websitePage.findMany({ where: { companyId }, orderBy: [{ position: "asc" }, { slug: "asc" }], select: { id: true } });
  const at = pages.findIndex((p) => p.id === id);
  const to = at + direction;
  if (to >= 0 && to < pages.length) {
    [pages[at], pages[to]] = [pages[to], pages[at]];
    await prisma.$transaction(pages.map((p, i) => prisma.websitePage.update({ where: { id: p.id }, data: { position: i } })));
    done(companyId);
  }
  return { id };
}

export async function deletePage(companySlug: string, ref: string): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const id = await pageId(companyId, ref);
  if (!id) return { error: "This page no longer exists." };
  const page = await prisma.websitePage.findUniqueOrThrow({ where: { id } });
  if (page.slug === "") return { error: "The home page can't be deleted." };
  await prisma.websitePage.delete({ where: { id } });
  done(companyId);
  return {};
}

// ---- Design
export async function saveTheme(companySlug: string, raw: unknown): Promise<Result> {
  const { companyId } = await ctx(companySlug);
  const theme = readTheme(raw);
  await prisma.websiteSettings.upsert({
    where: { companyId },
    create: { companyId, theme: theme as unknown as Prisma.InputJsonValue },
    update: { theme: theme as unknown as Prisma.InputJsonValue },
  });
  done(companyId);
  return {};
}
