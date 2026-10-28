"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { homePath, isCompanySlug, isRole } from "@/lib/permissions";

export type LoginState = { error?: string; email?: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { company: true },
  });

  // Same message for unknown email and wrong password, so accounts can't be probed.
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!user || !ok) return { error: "Incorrect email or password", email };
  if (!user.active) return { error: "This account has been deactivated. Contact your manager.", email };
  if (!isRole(user.role)) return { error: "This account has no valid role. Contact an admin.", email };

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);

  // Return to the page they originally asked for (the proxy put it in ?next=).
  // Same-site paths only; that page still runs its own role check.
  const next = nextFromReferer((await headers()).get("referer"));
  if (/^\/(?![/\\])/.test(next) && !next.startsWith("/login")) redirect(next);

  const slug = user.company?.slug ?? null;
  redirect(homePath({ role: user.role, companySlug: slug && isCompanySlug(slug) ? slug : null }));
}

function nextFromReferer(referer: string | null) {
  try {
    return referer ? (new URL(referer).searchParams.get("next") ?? "") : "";
  } catch {
    return "";
  }
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
