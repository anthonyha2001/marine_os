import "server-only";
import { prisma } from "@/lib/prisma";
import { companyIdFor } from "@/lib/data/inventory";
import type { CompanySlug } from "@/lib/permissions";

// The staff side of customer portal conversations (Customers → Messages). Read fresh.

export async function listThreads(slug: CompanySlug, show: "open" | "closed" | "all" = "open") {
  const companyId = await companyIdFor(slug);
  const rows = await prisma.portalThread.findMany({
    where: { companyId, ...(show === "all" ? {} : { status: show === "open" ? "OPEN" : "CLOSED" }) },
    orderBy: [{ staffUnread: "desc" }, { lastMessageAt: "desc" }],
    take: 200,
    include: { customer: { select: { id: true, name: true, phone: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return rows.map((t) => ({ ...t, last: t.messages[0] ?? null }));
}

export async function threadCounts(slug: CompanySlug) {
  const companyId = await companyIdFor(slug);
  const [unread, open] = await Promise.all([
    prisma.portalThread.count({ where: { companyId, staffUnread: true } }),
    prisma.portalThread.count({ where: { companyId, status: "OPEN" } }),
  ]);
  return { unread, open };
}

/** One conversation for the inbox pop-up; opening it marks the customer's messages as read. */
export async function getThread(slug: CompanySlug, threadId: string) {
  const companyId = await companyIdFor(slug);
  const thread = await prisma.portalThread.findFirst({
    where: { id: threadId, companyId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true, portalToken: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) return null;
  if (thread.staffUnread) await prisma.portalThread.update({ where: { id: thread.id }, data: { staffUnread: false } });
  const [vessel, warranty] = await Promise.all([
    thread.vesselId ? prisma.vessel.findUnique({ where: { id: thread.vesselId }, select: { id: true, name: true } }) : null,
    thread.warrantyId ? prisma.warranty.findUnique({ where: { id: thread.warrantyId }, select: { id: true, number: true, item: true } }) : null,
  ]);
  return { ...thread, vessel, warranty };
}
