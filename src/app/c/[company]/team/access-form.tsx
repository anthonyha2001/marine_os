"use client";

import { useActionState, useState } from "react";
import { saveStaffAccess, type AccessFormState } from "@/lib/actions/team";
import { FormMessage, Kbd, primaryButton } from "@/components/ui";

type Option = { key: string; label: string; hint?: string };

/** Role defaults, or a custom list of pages and rights for one person. */
export function AccessForm({
  companySlug,
  userId,
  roleLabel,
  custom,
  modules,
  caps,
  checkedModules,
  checkedCaps,
}: {
  companySlug: string;
  userId: string;
  roleLabel: string;
  custom: boolean;
  modules: Option[];
  caps: Option[];
  checkedModules: string[];
  checkedCaps: string[];
}) {
  const [state, formAction, pending] = useActionState<AccessFormState, FormData>(saveStaffAccess.bind(null, companySlug, userId), {});
  const [mode, setMode] = useState(custom ? "custom" : "role");
  return (
    <form action={formAction} data-save-shortcut className="space-y-5">
      <fieldset className="grid gap-2 sm:grid-cols-2">
        {[
          ["role", `Use the ${roleLabel} defaults`, "Changes with the role."],
          ["custom", "Custom permissions", "Pick exactly what this person can open and do."],
        ].map(([value, label, hint]) => (
          <label key={value} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${mode === value ? "border-brand bg-brand-soft" : "border-border"}`}>
            <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-0.5 size-4 accent-brand" />
            <span>
              <span className="font-medium text-navy">{label}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className={mode === "custom" ? "" : "pointer-events-none opacity-50"} aria-disabled={mode !== "custom"}>
        <h3 className="text-sm font-semibold text-navy">Pages they can open</h3>
        <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {modules.map((m) => (
            <label key={m.key} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" name="modules" value={m.key} defaultChecked={checkedModules.includes(m.key)} disabled={m.key === "dashboard"} className="size-4 accent-brand" />
              {m.label}
              {m.key === "dashboard" && <span className="text-xs text-muted">(always)</span>}
            </label>
          ))}
        </div>
        <h3 className="mt-5 text-sm font-semibold text-navy">What they can do</h3>
        <div className="mt-2 space-y-2">
          {caps.map((c) => (
            <label key={c.key} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="caps" value={c.key} defaultChecked={checkedCaps.includes(c.key)} className="mt-0.5 size-4 accent-brand" />
              <span>
                <span className="font-medium text-navy">{c.label}</span>
                {c.hint && <span className="block text-xs text-muted">{c.hint}</span>}
              </span>
            </label>
          ))}
          <p className="text-xs text-muted">Deleting posted entries stays with the admin. Every delete goes to the recycle bin and can be restored.</p>
        </div>
      </div>

      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Save permissions"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
