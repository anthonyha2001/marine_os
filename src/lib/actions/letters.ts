"use server";

import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { letterTag } from "@/lib/data/letters";
import { deleteRefusal } from "@/lib/delete-rules";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";
import type { CompanySlug } from "@/lib/permissions";
import { toRecycleBin } from "@/lib/recycle-bin";

export type LetterFormState = { error?: string };

const NUMBER_PREFIX: Record<CompanySlug, string> = { "xpert-marine": "XM", "eliche-radice": "ER" };

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const letterSchema = z.object({
  customerId: z.string().optional().transform((v) => v || null),
  offerId: z.string().optional().transform((v) => v || null),
  customerName: z.string().trim().min(2, "Enter who the letter is addressed to").max(200),
  customerAttention: text(200),
  customerAddress: text(1000),
  customerEmail: text(200),
  customerPhone: text(100),
  letterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  title: z.string().trim().min(1, "Enter the letter's title").max(80),
  reference: text(200),
  subject: text(300),
  salutation: text(200),
  body: z.string().trim().min(1, "Write the letter").max(20000),
  closing: text(200),
  signatoryName: text(200),
  signatoryTitle: text(200),
  fields: z
    .array(z.object({ label: z.string().trim().max(100), value: z.string().trim().max(1000) }))
    .max(30, "At most 30 detail rows")
    .transform((rows) => rows.filter((r) => r.label || r.value)),
  enclosures: text(500),
  cc: text(500),
  marking: text(100),
  acknowledgment: z.boolean(),
  notes: text(5000),
});

type LetterInput = z.infer<typeof letterSchema>;

function parse(payload: unknown): { data: LetterInput } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(String(payload ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = letterSchema.safeParse(raw);
  return parsed.success ? { data: parsed.data } : { error: parsed.error.issues[0].message };
}

function letterData(data: LetterInput) {
  const { letterDate, ...rest } = data;
  return { ...rest, letterDate: new Date(`${letterDate}T00:00:00Z`) };
}

async function nextLetterNumber(tx: Tx, slug: CompanySlug, year: number) {
  const prefix = `${NUMBER_PREFIX[slug]}-LT-${year}-`;
  const last = await tx.letter.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } });
  const next = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return prefix + String(next).padStart(4, "0");
}

/** Keep links only to a saved customer, and to an offer of this company. */
async function checkedLinks(data: LetterInput, companyId: string) {
  const [customer, offer] = await Promise.all([
    data.customerId ? prisma.customer.findUnique({ where: { id: data.customerId }, select: { id: true } }) : null,
    data.offerId ? prisma.offer.findFirst({ where: { id: data.offerId, companyId }, select: { id: true } }) : null,
  ]);
  return { customerId: customer?.id ?? null, offerId: offer?.id ?? null };
}

/** Create (letterId = null) or update a letter of the company being viewed. */
export async function saveLetter(companySlug: string, letterId: string | null, _prev: LetterFormState, formData: FormData): Promise<LetterFormState> {
  const { user, slug } = await requireModule(companySlug, "offers");
  const result = parse(formData.get("payload"));
  if ("error" in result) return { error: result.error };
  const { data } = result;
  const companyId = await companyIdFor(slug);
  const links = await checkedLinks(data, companyId);
  const fields = { ...letterData(data), ...links };

  let savedId: string;
  if (letterId) {
    const existing = await prisma.letter.findFirst({ where: { id: letterId, companyId }, select: { id: true } });
    if (!existing) return { error: "This letter no longer exists." };
    await prisma.letter.update({ where: { id: existing.id }, data: fields });
    savedId = existing.id;
  } else {
    const year = Number(data.letterDate.slice(0, 4));
    let attempt = 0;
    for (;;) {
      try {
        savedId = await prisma.$transaction(async (tx) => {
          const letter = await tx.letter.create({
            select: { id: true },
            data: { ...fields, companyId, number: await nextLetterNumber(tx, slug, year), createdById: user.id },
          });
          return letter.id;
        }, TRANSACTION_OPTIONS);
        break;
      } catch (e) {
        // Two letters saved at the same moment can race for a number; retry.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt++ < 3) continue;
        throw e;
      }
    }
  }

  updateTag(letterTag(companyId));
  redirect(`/c/${slug}/letters/${savedId}?saved=1`);
}

/** The letter as it would print, before saving (base64 PDF). */
export async function previewLetter(companySlug: string, payload: string): Promise<{ error?: string; pdf?: string }> {
  const { user, slug } = await requireModule(companySlug, "offers");
  const result = parse(payload);
  if ("error" in result) return { error: result.error };
  const { data } = result;
  const { createElement } = await import("react");
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { LetterPdf } = await import("@/lib/pdf/letter-pdf");
  const { getCompanyProfile } = await import("@/lib/data/sales");
  const { isBilingual } = await import("@/lib/pdf-language");
  const companyId = await companyIdFor(slug);
  const links = await checkedLinks(data, companyId);
  const offer = links.offerId ? await prisma.offer.findUnique({ where: { id: links.offerId }, select: { number: true } }) : null;
  const [company, bilingual] = await Promise.all([getCompanyProfile(slug), isBilingual(links.customerId)]);
  const letter = { ...letterData(data), number: "PREVIEW", offerNumber: offer?.number ?? null, createdByName: user.name };
  const element = createElement(LetterPdf, { slug, letter, company, bilingual }) as Parameters<typeof renderToBuffer>[0];
  return { pdf: Buffer.from(await renderToBuffer(element)).toString("base64") };
}

export async function deleteLetter(companySlug: string, letterId: string): Promise<{ error?: string }> {
  const { user, slug } = await requireModule(companySlug, "offers");
  const companyId = await companyIdFor(slug);
  const letter = await prisma.letter.findFirst({ where: { id: letterId, companyId }, select: { number: true, customerName: true } });
  if (!letter) return { error: "This letter no longer exists." };
  const refused = deleteRefusal(user, "draft");
  if (refused) return { error: refused };
  await prisma.$transaction(async (tx) => {
    await toRecycleBin(tx, { model: "Letter", id: letterId, companyId, label: `Letter ${letter.number} · ${letter.customerName}`, deletedByName: user.name });
    await tx.letter.delete({ where: { id: letterId } });
  }, TRANSACTION_OPTIONS);
  updateTag(letterTag(companyId));
  redirect(`/c/${slug}/letters`);
}
