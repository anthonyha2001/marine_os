"use server";

import bcrypt from "bcryptjs";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, userTag } from "@/lib/auth";
import { ROLE_LABELS, assignableRoles, isRole, type Role } from "@/lib/permissions";

export type TeamFormState = { error?: string; success?: string };

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.string().refine(isRole, "Choose a role"),
});

/** Create a staff account in the company whose Team page this was submitted from. */
export async function createStaff(
  companySlug: string,
  _prev: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const { user: actor, slug } = await requireModule(companySlug, "team");

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const role = parsed.data.role as Role;

  if (!assignableRoles(actor).includes(role)) {
    return { error: "You are not allowed to assign that role" };
  }

  if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) {
    return { error: "An account with this email already exists" };
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { slug } });
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role,
      companyId: company.id,
    },
  });

  revalidatePath(`/c/${slug}/team`);
  return { success: `${parsed.data.name} was added as ${ROLE_LABELS[role]}` };
}

/** Change a staff member's role, or activate/deactivate them. */
export async function updateStaff(companySlug: string, formData: FormData) {
  const { user: actor, slug } = await requireModule(companySlug, "team");

  const targetId = String(formData.get("userId"));
  if (targetId === actor.id) return; // nobody edits their own role or locks themselves out

  const target = await prisma.user.findUnique({ where: { id: targetId }, include: { company: true } });
  if (!target || target.company?.slug !== slug) return;

  const allowed = assignableRoles(actor);
  // Managers can only touch people whose current role they could have assigned.
  if (!isRole(target.role) || !allowed.includes(target.role)) return;

  const newRole = formData.get("role");
  const active = formData.get("active");

  await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(typeof newRole === "string" && isRole(newRole) && allowed.includes(newRole)
        ? { role: newRole }
        : {}),
      ...(active === "true" || active === "false" ? { active: active === "true" } : {}),
    },
  });
  updateTag(userTag(target.id));

  revalidatePath(`/c/${slug}/team`);
}
