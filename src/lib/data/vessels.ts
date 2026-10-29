import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DATA_TAG } from "@/lib/cache-tag";

// Vessels are shared by both companies (like customers). Their history is gathered per company.
export const vesselsTag = "vessels";

async function loadVessels() {
  "use cache";
  cacheTag(DATA_TAG, vesselsTag);
  cacheLife("hours");
  const rows = await prisma.vessel.findMany({
    include: { customer: { select: { id: true, name: true } }, engines: { orderBy: { position: "asc" } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    customer: v.customer,
    type: v.type,
    make: v.make,
    model: v.model,
    lengthM: v.lengthM === null ? null : Number(v.lengthM),
    year: v.year,
    registration: v.registration,
    hullNumber: v.hullNumber,
    homePort: v.homePort,
    notes: v.notes,
    active: v.active,
    engines: v.engines.map((e) => ({
      id: e.id,
      position: e.position,
      make: e.make,
      model: e.model,
      serialNumber: e.serialNumber,
      year: e.year,
      hours: e.hours,
      notes: e.notes,
    })),
  }));
}

export async function listVessels() {
  return loadVessels();
}
export type VesselRow = Awaited<ReturnType<typeof loadVessels>>[number];

export async function getVessel(id: string) {
  return (await loadVessels()).find((v) => v.id === id) ?? null;
}

/** Compact list for pickers: name, owner and a label like "Blue Pearl · Sunseeker 52". */
export async function vesselOptions() {
  return (await loadVessels())
    .filter((v) => v.active)
    .map((v) => ({ id: v.id, name: v.name, customerId: v.customer?.id ?? null, label: [v.name, [v.make, v.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ") }));
}
export type VesselOption = Awaited<ReturnType<typeof vesselOptions>>[number];
