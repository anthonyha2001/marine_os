"use client";

import { useActionState, useState, useTransition } from "react";
import { Ban, CheckCircle2, XCircle } from "lucide-react";
import { confirmAppointment, createAppointment, setAppointmentStatus, type AppointmentFormState } from "@/lib/actions/appointments";
import type { VesselOption } from "@/lib/data/vessels";
import { useFeedback } from "@/components/feedback";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

export function SlotFields({ slots, date, time }: { slots: string[]; date: string; time: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>
        Date *
        <input name="date" type="date" required defaultValue={date} className={inputClass} />
      </label>
      <label className={labelClass}>
        Time *
        <select name="time" defaultValue={time} className={inputClass}>
          {slots.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function ConfirmForm({ companySlug, appointmentId, slots, date, time }: { companySlug: string; appointmentId: string; slots: string[]; date: string; time: string }) {
  const [state, formAction, pending] = useActionState<AppointmentFormState, FormData>(confirmAppointment.bind(null, companySlug, appointmentId), {});
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <SlotFields slots={slots} date={date} time={time} />
      <label className={labelClass}>
        Note for the team
        <input name="staffNote" maxLength={1000} placeholder="e.g. Haul out needed" className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Confirm appointment"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

export function NewAppointmentForm({
  companySlug,
  slots,
  date,
  customers,
  vessels,
}: {
  companySlug: string;
  slots: string[];
  date: string;
  customers: { id: string; name: string }[];
  vessels: VesselOption[];
}) {
  const [state, formAction, pending] = useActionState<AppointmentFormState, FormData>(createAppointment.bind(null, companySlug), {});
  const [customerId, setCustomerId] = useState("");
  const first = useFocusOnShow<HTMLSelectElement>();
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Customer *
          <select ref={first} name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
            <option value="">— Not saved: type the name —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {!customerId && (
          <label className={labelClass}>
            Customer name *
            <input name="customerName" maxLength={200} className={inputClass} />
          </label>
        )}
        <label className={labelClass}>
          Vessel
          <select name="vesselId" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {vessels
              .filter((v) => !customerId || v.customerId === customerId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
          </select>
        </label>
        <label className={labelClass}>
          Phone
          <input name="phone" maxLength={60} className={inputClass} />
        </label>
      </div>
      <SlotFields slots={slots} date={date} time={slots[1] ?? slots[0]} />
      <label className={labelClass}>
        What is it for? *
        <input name="reason" required maxLength={1000} placeholder="e.g. 100 h service, propeller check" className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Book"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

export function AppointmentActions({ companySlug, appointmentId, status, label }: { companySlug: string; appointmentId: string; status: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else toast.success(ok);
    });
  const btn = "inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy";
  return (
    <span className="inline-flex">
      {status === "CONFIRMED" && (
        <button type="button" disabled={pending} title="Done" aria-label={`Done: ${label}`} className={btn} onClick={() => run(() => setAppointmentStatus(companySlug, appointmentId, "DONE"), "Marked as done.")}>
          <CheckCircle2 className="size-4" aria-hidden />
        </button>
      )}
      {status === "REQUESTED" && (
        <button
          type="button"
          disabled={pending}
          title="Decline"
          aria-label={`Decline ${label}`}
          className={`${btn} hover:text-danger`}
          onClick={async () => {
            if (await confirm({ title: `Decline ${label}?`, message: "The customer sees it as declined in their portal. Call them to propose another time.", confirmLabel: "Decline", tone: "danger" }))
              run(() => setAppointmentStatus(companySlug, appointmentId, "DECLINED"), "Declined.");
          }}
        >
          <XCircle className="size-4" aria-hidden />
        </button>
      )}
      {status === "CONFIRMED" && (
        <button
          type="button"
          disabled={pending}
          title="Cancel"
          aria-label={`Cancel ${label}`}
          className={`${btn} hover:text-danger`}
          onClick={async () => {
            if (await confirm({ title: `Cancel ${label}?`, message: "The customer sees it as cancelled in their portal.", confirmLabel: "Cancel appointment", tone: "danger" }))
              run(() => setAppointmentStatus(companySlug, appointmentId, "CANCELLED"), "Cancelled.");
          }}
        >
          <Ban className="size-4" aria-hidden />
        </button>
      )}
    </span>
  );
}
