import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStaff } from "@/lib/actions/team";
import { COMPANIES, ROLE_LABELS, assignableRoles, isRole } from "@/lib/permissions";
import { AddStaffForm } from "./add-staff-form";

async function TeamContent({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { user, slug } = await requireModule(company, "team");
  const roles = assignableRoles(user);

  const staff = await prisma.user.findMany({
    where: { company: { slug } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const update = updateStaff.bind(null, slug);

  return (
    <>
      <p className="text-sm text-muted">{COMPANIES[slug].name}</p>
      <h1 className="text-2xl font-semibold text-navy">Team &amp; roles</h1>
      <p className="mt-1 text-muted">Create accounts and decide what each person can open.</p>

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
    </>
  );
}

export default function TeamPage({ params }: PageProps<"/c/[company]/team">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <TeamContent params={params} />
    </Suspense>
  );
}
