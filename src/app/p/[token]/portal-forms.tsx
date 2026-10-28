"use client";

import { useActionState, useTransition } from "react";
import { bookAppointment, cancelMyAppointment, type PortalState } from "@/lib/actions/portal";
import { useFeedback } from "@/components/feedback";
import { FormMessage, inputClass, labelClass, primaryButton, secondaryButtonSm } from "@/components/ui";

export function BookingForm({
  token,
  slots,
  minDate,
  companies,
  vessels,
}: {
  token: string;
  slots: string[];
  minDate: string;
  companies: { slug: string; name: string; what: string }[];
  vessels: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<PortalState, FormData>(bookAppointment.bind(null, token), {});
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Service *
          <select name="company" defaultValue={companies[0]?.slug} className={inputClass}>
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} — {c.what}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Boat
          <select name="vesselId" defaultValue={vessels[0]?.id ?? ""} className={inputClass}>
            <option value="">—</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Preferred day *
          <input name="date" type="date" required min={minDate} defaultValue={minDate} className={inputClass} />
        </label>
        <label className={labelClass}>
          Preferred time *
          <select name="time" defaultValue="09:00" className={inputClass}>
            {slots.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label className={labelClass}>
        What do you need? *
        <textarea name="reason" required rows={2} maxLength={1000} placeholder="e.g. 100-hour service on both engines, propeller vibration" className={inputClass} />
      </label>
      <label className={labelClass}>
        Phone to reach you
        <input name="phone" maxLength={60} autoComplete="tel" className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full sm:w-auto`}>
        {pending ? "Sending…" : "Request appointment"}
      </button>
      <p className="text-xs text-muted">We confirm by updating this page (and calling you if we need to change the time). Closed on Sundays.</p>
    </form>
  );
}

export function CancelMine({ token, appointmentId }: { token: string; appointmentId: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  return (
    <button
      type="button"
      disabled={pending}
      className={secondaryButtonSm}
      onClick={async () => {
        if (!(await confirm({ title: "Cancel this appointment?", message: "You can book a new one at any time.", confirmLabel: "Cancel appointment", cancelLabel: "Keep it", tone: "danger" }))) return;
        startTransition(async () => {
          const res = await cancelMyAppointment(token, appointmentId);
          if (res.error) toast.error(res.error);
          else toast.success("Appointment cancelled.");
        });
      }}
    >
      {pending ? "Cancelling…" : "Cancel"}
    </button>
  );
}
