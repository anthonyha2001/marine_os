"use client";

import { useTransition } from "react";
import { UserCheck, UserX } from "lucide-react";
import { setEmployeeActive } from "@/lib/actions/payroll";
import { useFeedback } from "@/components/feedback";

/** Mark someone as having left (kept for past payrolls), or bring them back. */
export function ActiveToggle({ companySlug, employeeId, name, active }: { companySlug: string; employeeId: string; name: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  const label = active ? "Mark as left" : "Bring back";
  return (
    <button
      type="button"
      disabled={pending}
      title={label}
      aria-label={`${label}: ${name}`}
      onClick={async () => {
        if (active && !(await confirm({ title: `${name} has left?`, message: "They won't be added to new payrolls. Past payrolls keep them.", confirmLabel: "Mark as left" }))) return;
        startTransition(async () => {
          const res = await setEmployeeActive(companySlug, employeeId, !active);
          if (res.error) toast.error(res.error);
          else toast.success(active ? `${name} marked as left.` : `${name} is active again.`);
        });
      }}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy"
    >
      {active ? <UserX className="size-4" aria-hidden /> : <UserCheck className="size-4" aria-hidden />}
    </button>
  );
}
