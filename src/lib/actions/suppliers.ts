"use server";

import { Prisma } from "@prisma/client";
import { updateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { tags } from "@/lib/data/inventory";

export type SupplierFormState = { error?: string; success?: string };

const optional = z
  .string()
  .trim()
  .max(500)
  .transform((v) => v || null);

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is too short").max(200),
  accountNumber: optional,
  phone: optional,
  email: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email or leave it empty"),
  address: optional,
  notes: optional,
});

/** Create (supplierId = null) or update a shared supplier. */
export async function saveSupplier(
  companySlug: string,
  supplierId: string | null,
  _prev: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  await requireModule(companySlug, "suppliers");

  const parsed = supplierSchema.safeParse({
    name: formData.get("name") ?? "",
    accountNumber: formData.get("accountNumber") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    if (supplierId) {
      await prisma.supplier.update({ where: { id: supplierId }, data: parsed.data });
    } else {
      await prisma.supplier.create({ data: parsed.data });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `A supplier called "${parsed.data.name}" already exists.` };
    }
    throw e;
  }

  updateTag(tags.suppliers);
  updateTag(tags.products); // the catalogue shows supplier names
  return { success: supplierId ? "Supplier updated" : `${parsed.data.name} was added` };
}

// ── Documents ──
// Each file is sent in its own request: hosting accepts about 4.5 MB per request.

const MAX_FILE = 4 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
};

export async function uploadSupplierDocument(companySlug: string, supplierId: string, formData: FormData): Promise<{ error?: string }> {
  const { user } = await requireModule(companySlug, "suppliers");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a file." };
  const name = (String(formData.get("name") || "") || file.name).trim().slice(0, 200) || "Document";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = Object.values(FILE_TYPES).includes(file.type) ? file.type : FILE_TYPES[ext];
  if (!contentType) return { error: `${file.name}: only photos, PDF, Word, Excel and text files can be added.` };
  if (file.size > MAX_FILE) return { error: `${file.name} is too large (4 MB at most).` };
  if (!(await prisma.supplier.count({ where: { id: supplierId } }))) return { error: "This supplier no longer exists." };

  await prisma.supplierDocument.create({
    data: { supplierId, name, contentType, size: file.size, data: Buffer.from(await file.arrayBuffer()), uploadedBy: user.name },
  });
  updateTag(tags.supplierDocuments);
  return {};
}

export async function renameSupplierDocument(companySlug: string, documentId: string, name: string): Promise<{ error?: string }> {
  await requireModule(companySlug, "suppliers");
  const clean = name.trim().slice(0, 200);
  if (!clean) return { error: "Give the file a name." };
  await prisma.supplierDocument.updateMany({ where: { id: documentId }, data: { name: clean } });
  updateTag(tags.supplierDocuments);
  return {};
}

export async function deleteSupplierDocument(companySlug: string, documentId: string): Promise<{ error?: string }> {
  await requireModule(companySlug, "suppliers");
  await prisma.supplierDocument.deleteMany({ where: { id: documentId } });
  updateTag(tags.supplierDocuments);
  return {};
}
