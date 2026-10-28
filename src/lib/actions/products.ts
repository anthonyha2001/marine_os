"use server";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { internalBarcodeFor, parseBarcodes } from "@/lib/barcode";
import { tags } from "@/lib/data/inventory";
import { TRANSACTION_OPTIONS, nextItemCode } from "@/lib/item-codes";
import { deleteProductImage, uploadProductImage } from "@/lib/storage";

export type ProductFormState = { error?: string };

const productSchema = z.object({
  name: z.string().trim().min(2, "Product name is too short").max(200),
  description: z.string().trim().max(2000).optional(),
  supplierId: z.string().optional(),
  priceHT: z.coerce.number({ message: "Enter a price" }).min(0, "Price can't be negative").max(10_000_000),
  minQuantity: z.coerce.number().int("Minimum quantity must be a whole number").min(0).default(0),
  barcodes: z.string().default(""),
  trackSerials: z.boolean().default(false),
});

const BARCODE_PATTERN = /^[A-Za-z0-9-]{4,32}$/;


/** Barcodes already used by a different product, for a clear error message. */
async function barcodeConflicts(codes: string[], productId: string | null) {
  if (codes.length === 0) return [];
  return prisma.productBarcode.findMany({
    where: { code: { in: codes }, ...(productId ? { productId: { not: productId } } : {}) },
    include: { product: { select: { code: true, name: true } } },
  });
}

/** Create (productId = null) or update a shared product. */
export async function saveProduct(
  companySlug: string,
  productId: string | null,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const { slug } = await requireModule(companySlug, "inventory");

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    supplierId: formData.get("supplierId") || undefined,
    priceHT: formData.get("priceHT"),
    minQuantity: formData.get("minQuantity") || 0,
    barcodes: formData.get("barcodes") ?? "",
    trackSerials: formData.get("trackSerials") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const barcodes = parseBarcodes(data.barcodes);
  const invalid = barcodes.find((b) => !BARCODE_PATTERN.test(b));
  if (invalid) return { error: `"${invalid}" isn't a valid barcode (4–32 letters or digits).` };

  // Independent checks run in parallel; each one is a round trip to the database.
  const [conflicts, supplier, existing] = await Promise.all([
    barcodeConflicts(barcodes, productId),
    data.supplierId ? prisma.supplier.findUnique({ where: { id: data.supplierId }, select: { id: true } }) : null,
    productId ? prisma.product.findUnique({ where: { id: productId } }) : null,
  ]);
  if (conflicts.length > 0) {
    const c = conflicts[0];
    return { error: `Barcode ${c.code} is already used by ${c.product.name} (#${c.product.code}).` };
  }
  if (data.supplierId && !supplier) return { error: "That supplier no longer exists." };
  if (productId && (!existing || existing.type !== "PRODUCT")) return { error: "This product no longer exists." };

  // Picture: upload first; a failed upload shouldn't leave a half-saved product.
  let imageUrl = existing?.imageUrl ?? null;
  const image = formData.get("image");
  const removeImage = formData.get("removeImage") === "true";
  try {
    if (image instanceof File && image.size > 0) {
      imageUrl = await uploadProductImage(productId ?? randomUUID(), image);
    } else if (removeImage) {
      imageUrl = null;
    }
  } catch (e) {
    return { error: (e as Error).message };
  }

  const fields = {
    name: data.name,
    description: data.description ?? null,
    supplierId: data.supplierId ?? null,
    priceHT: data.priceHT,
    minQuantity: data.minQuantity,
    trackSerials: data.trackSerials,
    imageUrl,
  };

  let savedCode: string;
  try {
    savedCode = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.product.update({ where: { id: existing.id }, data: fields });
        await tx.productBarcode.deleteMany({ where: { productId: existing.id } });
        const codes = barcodes.length > 0 ? barcodes : [internalBarcodeFor(existing.code)];
        await tx.productBarcode.createMany({ data: codes.map((code) => ({ code, productId: existing.id })) });
        return existing.code;
      } else {
        const code = await nextItemCode(tx);
        const codes = barcodes.length > 0 ? barcodes : [internalBarcodeFor(code)];
        await tx.product.create({
          data: { ...fields, code, barcodes: { create: codes.map((c) => ({ code: c })) } },
        });
        return code;
      }
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    // Two people saving at the same moment can race for the same code or barcode.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That code or barcode was just taken by another product. Please save again." };
    }
    throw e;
  }

  if (existing && existing.imageUrl !== imageUrl) await deleteProductImage(existing.imageUrl).catch(() => {});

  updateTag(tags.products);
  // "Save & add another" (Ctrl+Shift+S) goes straight back to an empty form.
  if (formData.get("intent") === "new") {
    redirect(`/c/${slug}/inventory?new=1&saved=${savedCode}`);
  }
  redirect(`/c/${slug}/inventory?saved=${savedCode}`);
}

export type DeleteResult = { error?: string };

/** Delete a product, unless it has purchase/stock history (that would corrupt stock records). */
export async function deleteProduct(companySlug: string, productId: string): Promise<DeleteResult> {
  const { slug } = await requireModule(companySlug, "inventory");
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { type: true, imageUrl: true, _count: { select: { purchaseItems: true, stockMovements: true } } },
  });
  if (!product || product.type !== "PRODUCT") return { error: "This product no longer exists." };
  if (product._count.purchaseItems > 0 || product._count.stockMovements > 0) {
    return { error: "This product appears in purchases or stock history, so it can't be deleted." };
  }

  // Offer lines keep their own copy of the title and price, so offers are unaffected.
  await prisma.product.delete({ where: { id: productId } });
  await deleteProductImage(product.imageUrl).catch(() => {});
  updateTag(tags.products);
  redirect(`/c/${slug}/inventory`);
}

export type QuickProduct = { id: string; code: string; name: string; priceHT: number; barcodes: string[] };

/**
 * Create a product from an order or purchase line without leaving the form: returns the new
 * product so it can be added to the lines straight away. Picture and details can be added later.
 */
export async function quickCreateProduct(
  companySlug: string,
  input: { name: string; priceHT: number; supplierId?: string | null; minQuantity?: number; barcodes?: string; description?: string },
): Promise<{ product?: QuickProduct; error?: string }> {
  await requireModule(companySlug, "purchases");

  const parsed = productSchema.safeParse({
    name: input.name,
    description: input.description || undefined,
    supplierId: input.supplierId || undefined,
    priceHT: input.priceHT,
    minQuantity: input.minQuantity ?? 0,
    barcodes: input.barcodes ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const barcodes = parseBarcodes(data.barcodes);
  const invalid = barcodes.find((b) => !BARCODE_PATTERN.test(b));
  if (invalid) return { error: `"${invalid}" isn't a valid barcode (4–32 letters or digits).` };
  const conflicts = await barcodeConflicts(barcodes, null);
  if (conflicts.length > 0) {
    const c = conflicts[0];
    return { error: `Barcode ${c.code} is already used by ${c.product.name} (#${c.product.code}).` };
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const code = await nextItemCode(tx);
      const codes = barcodes.length > 0 ? barcodes : [internalBarcodeFor(code)];
      const created = await tx.product.create({
        select: { id: true },
        data: {
          code,
          name: data.name,
          description: data.description ?? null,
          supplierId: data.supplierId ?? null,
          priceHT: data.priceHT,
          minQuantity: data.minQuantity,
          trackSerials: data.trackSerials,
          barcodes: { create: codes.map((c) => ({ code: c })) },
        },
      });
      return { id: created.id, code, codes };
    }, TRANSACTION_OPTIONS);
    updateTag(tags.products);
    return { product: { id: product.id, code: product.code, name: data.name, priceHT: data.priceHT, barcodes: product.codes } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That code or barcode was just taken by another product. Please try again." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { error: "That supplier no longer exists." };
    }
    throw e;
  }
}
