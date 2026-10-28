"use client";

import { useActionState, useEffect, useRef } from "react";
import { createStaff, type TeamFormState } from "@/lib/actions/team";

const inputClass =
  "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function AddStaffForm({
  companySlug,
  roles,
}: {
  companySlug: string;
  roles: { value: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState<TeamFormState, FormData>(
    createStaff.bind(null, companySlug),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-4 space-y-4">
      <label className="block text-sm font-medium text-navy">
        Full name
        <input name="name" required className={inputClass} />
      </label>
      <label className="block text-sm font-medium text-navy">
        Email
        <input name="email" type="email" required className={inputClass} />
      </label>
      <label className="block text-sm font-medium text-navy">
        Temporary password
        <input name="password" type="text" minLength={8} required className={inputClass} placeholder="At least 8 characters" />
      </label>
      <label className="block text-sm font-medium text-navy">
        Role
        <select name="role" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose a role…
          </option>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add staff member"}
      </button>
    </form>
  );
}
