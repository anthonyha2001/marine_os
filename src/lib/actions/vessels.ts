"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { vesselsTag } from "@/lib/data/vessels";
import { TRANSACTION_OPTIONS } from "@/lib/item-codes";

export type VesselFormState = { error?: string };

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const int = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : Math.round(Number(v))))
  .refine((v) => v === null || Number.isFinite(v), "Enter a whole number");

const engineSchema = z.object({
  id: z.string().optional(),
  position: z.string().trim().min(1, "Every engine needs a position (e.g. Port)").max(60),
  make: text(80),
  model: text(80),
  serialNumber: text(80),
  year: int,
  hours: int,
  notes: text(300),
});

const vesselSchema = z.object({
  name: z.string().trim().min(1, "Enter the vessel name").max(120),
  customerId: z.string().optional().transform((v) => v || null),
  type: text(60),
  make: text(80),
  model: text(80),
  lengthM: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v < 1000), "Enter the length in metres"),
  year: int,
  registration: text(80),
  hullNumber: text(80),
  homePort: text(120),
  notes: text(2000),
  engines: z.array(engineSchema).max(12),
});

/** Create or update a vessel with its engines (sent as JSON in "payload"). */
export async function saveVessel(companySlug: string, vesselId: string | null, _prev: VesselFormState, formData: FormData): Promise<VesselFormState> {
  const { slug } = await requireModule(companySlug, "customers");
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The form couldn't be read. Please try again." };
  }
  const parsed = vesselSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { engines, ...data } = parsed.data;
  if (data.customerId && !(await prisma.customer.findUnique({ where: { id: data.customerId }, select: { id: true } }))) {
    return { error: "That customer no longer exists." };
  }

  const id = await prisma.$transaction(async (tx) => {
    const vessel = vesselId
      ? await tx.vessel.update({ where: { id: vesselId }, data, select: { id: true } })
      : await tx.vessel.create({ data, select: { id: true } });
    const keep = engines.filter((e) => e.id).map((e) => e.id!);
    await tx.vesselEngine.deleteMany({ where: { vesselId: vessel.id, id: { notIn: keep } } });
    for (const e of engines) {
      const fields = { position: e.position, make: e.make, model: e.model, serialNumber: e.serialNumber, year: e.year, hours: e.hours, notes: e.notes };
      if (e.id) await tx.vesselEngine.updateMany({ where: { id: e.id, vesselId: vessel.id }, data: fields });
      else await tx.vesselEngine.create({ data: { ...fields, vesselId: vessel.id } });
    }
    return vessel.id;
  }, TRANSACTION_OPTIONS);

  updateTag(vesselsTag);
  redirect(`/c/${slug}/vessels/${id}?saved=1`);
}

export async function setVesselActive(companySlug: string, vesselId: string, active: boolean): Promise<{ error?: string }> {
  await requireModule(companySlug, "customers");
  await prisma.vessel.update({ where: { id: vesselId }, data: { active } });
  updateTag(vesselsTag);
  return {};
}
