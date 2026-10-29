"use server";

import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toRecycleBin } from "@/lib/recycle-bin";
import { deleteRefusal } from "@/lib/delete-rules";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { serialsTag } from "@/lib/data/serials";
import { vesselsTag } from "@/lib/data/vessels";

export type SerialFormState = { error?: string };

async function ctx(companySlug: string) {
  const c = await requireModule(companySlug, "inventory");
  return { ...c, companyId: await companyIdFor(c.slug) };
}

/** Register serial numbers (one per line) for a serial-tracked product, optionally from a purchase. */
export async function registerSerials(companySlug: string, _prev: SerialFormState, formData: FormData): Promise<SerialFormState> {
  const { slug, companyId } = await ctx(companySlug);
  const productId = String(formData.get("productId") ?? "");
  const purchaseId = String(formData.get("purchaseId") ?? "") || null;
  const serials = [
    ...new Set(
      String(formData.get("serials") ?? "")
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (!serials.length) return { error: "Enter at least one serial number (one per line)." };
  if (serials.some((s) => s.length > 80)) return { error: "Serial numbers are at most 80 characters." };
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, trackSerials: true, name: true } });
  if (!product) return { error: "Choose the product." };
  if (!product.trackSerials) return { error: `${product.name} isn't set to track serial numbers (edit the product first).` };
  if (purchaseId) {
    const item = await prisma.purchaseItem.findFirst({ where: { purchaseId, productId, purchase: { companyId } }, select: { quantity: true } });
    if (!item) return { error: "That purchase doesn't contain this product." };
    const already = await prisma.productSerial.count({ where: { purchaseId, productId } });
    if (already + serials.length > item.quantity) return { error: `This purchase has ${item.quantity} units; ${already} serial number(s) are already registered.` };
  }
  const existing = await prisma.productSerial.findMany({ where: { productId, serialNumber: { in: serials } }, select: { serialNumber: true } });
  if (existing.length) return { error: `Already registered: ${existing.map((e) => e.serialNumber).join(", ")}.` };
  try {
    await prisma.productSerial.createMany({ data: serials.map((serialNumber) => ({ productId, companyId, serialNumber, purchaseId })) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "One of these serial numbers is already registered." };
    throw e;
  }
  updateTag(serialsTag(companyId));
  redirect(`/c/${slug}/inventory/serials?saved=${serials.length}`);
}

/** Who the unit went to: customer (and boat), date and the document it was sold on. */
export async function markSerialSold(companySlug: string, serialId: string, _prev: SerialFormState, formData: FormData): Promise<SerialFormState> {
  const { slug, companyId } = await ctx(companySlug);
  const customerId = String(formData.get("customerId") ?? "") || null;
  const typedName = String(formData.get("customerName") ?? "").trim();
  const vesselId = String(formData.get("vesselId") ?? "") || null;
  const soldRef = String(formData.get("soldRef") ?? "").trim().slice(0, 60) || null;
  const soldAtRaw = String(formData.get("soldAt") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(soldAtRaw)) return { error: "Enter the date it was sold." };
  const customer = customerId ? await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true } }) : null;
  const name = customer?.name ?? typedName;
  if (name.length < 2) return { error: "Choose the customer or type their name." };
  const updated = await prisma.productSerial.updateMany({
    where: { id: serialId, companyId },
    data: { status: "SOLD", customerId: customer?.id ?? null, customerName: name, vesselId, soldRef, soldAt: new Date(`${soldAtRaw}T00:00:00Z`) },
  });
  if (!updated.count) return { error: "This serial number no longer exists." };
  updateTag(serialsTag(companyId));
  updateTag(vesselsTag);
  redirect(`/c/${slug}/inventory/serials?q=${encodeURIComponent(String(formData.get("serialNumber") ?? ""))}`);
}

export async function setSerialStatus(companySlug: string, serialId: string, status: "IN_STOCK" | "RETURNED" | "SCRAPPED"): Promise<{ error?: string }> {
  const { companyId } = await ctx(companySlug);
  await prisma.productSerial.updateMany({
    where: { id: serialId, companyId },
    data: status === "IN_STOCK" ? { status, customerId: null, customerName: null, vesselId: null, soldAt: null, soldRef: null } : { status },
  });
  updateTag(serialsTag(companyId));
  return {};
}

export async function deleteSerial(companySlug: string, serialId: string): Promise<{ error?: string }> {
  const { user, companyId } = await ctx(companySlug);
  const s = await prisma.productSerial.findFirst({ where: { id: serialId, companyId }, select: { status: true, serialNumber: true } });
  if (!s) return { error: "This serial number no longer exists." };
  if (s.status !== "IN_STOCK") return { error: "Only a serial number still in stock can be deleted (entered by mistake)." };
  const refused = deleteRefusal(user, "draft");
  if (refused) return { error: refused };
  await prisma.$transaction(async (tx) => {
    await toRecycleBin(tx, { model: "ProductSerial", id: serialId, companyId, label: `Serial number ${s.serialNumber}`, deletedByName: user.name });
    await tx.productSerial.delete({ where: { id: serialId } });
  });
  updateTag(serialsTag(companyId));
  return {};
}
