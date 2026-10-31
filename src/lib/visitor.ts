import "server-only";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/** A one-way fingerprint of the visitor, to limit how many messages one source can send. */
export async function visitorHash() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${ip}|${process.env.AUTH_SECRET ?? ""}`).digest("hex").slice(0, 32);
}

/** More than `max` website messages from this visitor in the last hour. */
export async function tooMany(companyId: string, ipHash: string, max = 5) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  return (await prisma.websiteMessage.count({ where: { companyId, ipHash, createdAt: { gte: since } } })) >= max;
}
