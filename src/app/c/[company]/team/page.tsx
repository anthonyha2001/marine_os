import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStaff } from "@/lib/actions/team";
import Link from "next/link";
import { CAPABILITIES, COMPANIES, MODULES, ROLE_CAPS, ROLE_LABELS, ROLE_MODULES, assignableRoles, can, grantableModules, isRole, parseAccess, type Capability } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { AccessForm } from "./access-form";
import { AddStaffForm } from "./add-staff-form";

async function TeamContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ access?: string; accessSaved?: string }> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "team");
  const roles = assignableRoles(user);

  const staff = await prisma.user.findMany({
    where: { company: { slug } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const update = updateStaff.bind(null, slug);
  const editing = search.access ? staff.find((m) => m.id === search.access && m.id !== user.id && isRole(m.role) && roles.includes(m.role)) : undefined;
  const editingAccess = editing ? parseAccess(editing.permissions) : null;

  return (
    <>
      <p className="text-sm text-muted">{COMPANIES[slug].name}</p>
      <h1 className="text-2xl font-semibold text-navy">Team &amp; roles</h1>
      <p className="mt-1 text-muted">Create accounts and decide what each person can open.</p>
      {search.accessSaved && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
          Permissions saved. They apply on that person&apos;s next click.
        </p>
      )}

      <div className="mt-8 grid gap-8 xl:grid-cols-[22rem_1fr]">
        <section className="h-fit rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-navy">Add a staff member</h2>
          <AddStaffForm companySlug={slug} roles={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
        </section>

        <section className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last sign-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((member) => {
                const editable = member.id !== user.id && isRole(member.role) && roles.includes(member.role);
                return (
                  <tr key={member.id} className={member.active ? "" : "opacity-60"}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{member.name}</p>
                      <p className="text-xs text-muted">{member.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <form action={update} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={member.id} />
                          <select
                            name="role"
                            defaultValue={member.role}
                            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                          >
                            {roles.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="text-xs font-medium text-brand hover:underline">
                            Save
                          </button>
                        </form>
                      ) : (
                        <span>{isRole(member.role) ? ROLE_LABELS[member.role] : member.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {member.permissions ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">Custom</span> : <span className="text-xs text-muted">Role defaults</span>}
                      {editable && (
                        <Link href={`/c/${slug}/team?access=${member.id}`} scroll={false} className="ml-2 text-xs font-medium text-brand hover:underline">
                          Edit
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <form action={update}>
                          <input type="hidden" name="userId" value={member.id} />
                          <input type="hidden" name="active" value={String(!member.active)} />
                          <button
                            type="submit"
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              member.active ? "bg-green-50 text-success" : "bg-gray-100 text-muted"
                            }`}
                            title={member.active ? "Click to deactivate" : "Click to reactivate"}
                          >
                            {member.active ? "Active" : "Deactivated"}
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted">{member.active ? "Active" : "Deactivated"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {member.lastLoginAt ? member.lastLoginAt.toLocaleString("en-GB") : "Never"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      {editing && isRole(editing.role) && (
        <Modal title={`Permissions · ${editing.name}`} closeHref={`/c/${slug}/team`} size="lg">
          <AccessForm
            key={editing.id}
            companySlug={slug}
            userId={editing.id}
            roleLabel={ROLE_LABELS[editing.role]}
            custom={!!editingAccess}
            modules={grantableModules(user).map((m) => ({ key: m, label: MODULES[m].label }))}
            caps={(Object.keys(CAPABILITIES) as Capability[]).filter((c) => can(user, c)).map((c) => ({ key: c, ...CAPABILITIES[c] }))}
            checkedModules={editingAccess?.modules ?? ROLE_MODULES[editing.role]}
            checkedCaps={editingAccess?.caps ?? ROLE_CAPS[editing.role]}
          />
        </Modal>
      )}
    </>
  );
}

export default function TeamPage({ params, searchParams }: PageProps<"/c/[company]/team">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <TeamContent params={params} searchParams={searchParams as Promise<{ access?: string; accessSaved?: string }>} />
    </Suspense>
  );
}
