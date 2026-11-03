import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DATA_TAG } from "@/lib/cache-tag";
import { companyIdFor } from "@/lib/data/inventory";
import { LIST_PAGE_SIZE } from "@/lib/data/lists";
import type { CompanySlug } from "@/lib/permissions";

export const letterTag = (companyId: string) => `letters:${companyId}`;

export type LetterField = { label: string; value: string };

/** Extra detail rows stored as JSON, kept only when well formed. */
export function letterFields(json: Prisma.JsonValue | null): LetterField[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((f) =>
    f && typeof f === "object" && !Array.isArray(f) && typeof f.label === "string" && typeof f.value === "string" ? [{ label: f.label, value: f.value }] : [],
  );
}

async function loadLetterPage(companyId: string, q: string, page: number) {
  "use cache";
  cacheTag(DATA_TAG, letterTag(companyId));
  cacheLife("hours");
  const contains = { contains: q, mode: "insensitive" as const };
  const where: Prisma.LetterWhereInput = {
    companyId,
    ...(q ? { OR: [{ number: contains }, { customerName: contains }, { subject: contains }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.letter.count({ where }),
    prisma.letter.findMany({
      where,
      select: { id: true, number: true, letterDate: true, customerName: true, subject: true, title: true, offer: { select: { id: true, number: true } } },
      orderBy: [{ letterDate: "desc" }, { number: "desc" }],
      skip: (page - 1) * LIST_PAGE_SIZE,
      take: LIST_PAGE_SIZE,
    }),
  ]);
  return { total, rows };
}

/** One page of letters (newest first), searched by number, customer or subject. */
export async function letterPage(slug: CompanySlug, q: string, page: number) {
  return loadLetterPage(await companyIdFor(slug), q.trim(), page);
}

async function loadLetter(companyId: string, id: string) {
  "use cache";
  cacheTag(DATA_TAG, letterTag(companyId));
  cacheLife("hours");
  const letter = await prisma.letter.findFirst({
    where: { id, companyId },
    include: { offer: { select: { id: true, number: true } }, createdBy: { select: { name: true } } },
  });
  if (!letter) return null;
  const { fields, createdBy, ...rest } = letter;
  return { ...rest, fields: letterFields(fields), createdByName: createdBy.name };
}

export type LetterDetail = NonNullable<Awaited<ReturnType<typeof loadLetter>>>;

export async function getLetter(slug: CompanySlug, id: string) {
  return loadLetter(await companyIdFor(slug), id);
}
