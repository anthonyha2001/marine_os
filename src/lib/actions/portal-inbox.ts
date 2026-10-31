"use server";

import { refresh } from "next/cache";
import { requireModule } from "@/lib/auth";
import { companyIdFor } from "@/lib/data/inventory";
import { prisma } from "@/lib/prisma";

// Staff answers to customer portal conversations.

export type InboxState = { error?: string; done?: boolean };

export async function replyToCustomer(companySlug: string, threadId: string, _prev: InboxState, formData: FormData): Promise<InboxState> {
  const { user, slug } = await requireModule(companySlug, "customers");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write your answer." };
  if (body.length > 4000) return { error: "That answer is too long." };
  const companyId = await companyIdFor(slug);
  const thread = await prisma.portalThread.findFirst({ where: { id: threadId, companyId }, select: { id: true } });
  if (!thread) return { error: "This conversation no longer exists." };
  const close = formData.get("close") === "1";
  await prisma.portalThread.update({
    where: { id: thread.id },
    data: {
      customerUnread: true,
      staffUnread: false,
      status: close ? "CLOSED" : "OPEN",
      lastMessageAt: new Date(),
      messages: { create: { fromCustomer: false, authorName: user.name, body } },
    },
  });
  refresh();
  return { done: true };
}

export async function setThreadStatus(companySlug: string, threadId: string, status: "OPEN" | "CLOSED"): Promise<{ error?: string }> {
  const { slug } = await requireModule(companySlug, "customers");
  const companyId = await companyIdFor(slug);
  const res = await prisma.portalThread.updateMany({ where: { id: threadId, companyId }, data: { status, staffUnread: false } });
  if (!res.count) return { error: "This conversation no longer exists." };
  refresh();
  return {};
}
