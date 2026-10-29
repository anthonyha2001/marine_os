import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "@/lib/session-token";
import {
  canAccessCompany,
  canAccessModule,
  isCompanySlug,
  isRole,
  parseAccess,
  type CompanySlug,
  type CustomAccess,
  type ModuleKey,
  type Role,
} from "@/lib/permissions";
import { DATA_TAG } from "@/lib/cache-tag";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  companySlug: CompanySlug | null;
  /** Custom permissions set on the Team page (null = the role's defaults). */
  access: CustomAccess;
};

export async function createSession(userId: string) {
  const token = await signSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const userTag = (userId: string) => `user:${userId}`;

/**
 * User record cached in server memory (the database is far away). The Team page
 * calls updateTag(userTag(id)) on every change, so role changes and deactivation
 * apply on the next request; edits made directly in the database apply within 5 minutes.
 */
async function loadUser(userId: string): Promise<SessionUser | null> {
  "use cache";
  cacheTag(DATA_TAG, userTag(userId));
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: { select: { slug: true } } },
  });
  if (!user || !user.active || !isRole(user.role)) return null;

  const slug = user.company?.slug ?? null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companySlug: slug && isCompanySlug(slug) ? slug : null,
    access: parseAccess(user.permissions),
  };
}

/** The logged-in user, or null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const userId = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return userId ? loadUser(userId) : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireCompany(slug: string) {
  const user = await requireUser();
  if (!isCompanySlug(slug) || !canAccessCompany(user, slug)) redirect("/forbidden");
  return { user, slug };
}

export async function requireModule(slug: string, mod: ModuleKey) {
  const ctx = await requireCompany(slug);
  if (!canAccessModule(ctx.user, ctx.slug, mod)) redirect("/forbidden");
  return ctx;
}
