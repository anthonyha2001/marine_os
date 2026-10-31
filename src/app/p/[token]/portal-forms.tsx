"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { bookAppointment, cancelMyAppointment, claimWarranty, replyAsCustomer, startThread, updateEngineHours, updateMyDetails, type PortalState } from "@/lib/actions/portal";
import { useFeedback } from "@/components/feedback";
import { FormMessage, inputClass, labelClass, primaryButton, secondaryButtonSm } from "@/components/ui";

export function BookingForm({
  token,
  slots,
  minDate,
  companies,
  vessels,
  defaultVesselId,
}: {
  token: string;
  slots: string[];
  minDate: string;
  companies: { slug: string; name: string; what: string }[];
  vessels: { id: string; name: string }[];
  defaultVesselId?: string; // "Book a service" from a boat page
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
          <select name="vesselId" defaultValue={vessels.find((v) => v.id === defaultVesselId)?.id ?? vessels[0]?.id ?? ""} className={inputClass}>
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

/** The customer reads the hour meters and types them in; the workshop is told. */
export function EngineHoursForm({
  token,
  vesselId,
  engines,
}: {
  token: string;
  vesselId: string;
  engines: { id: string; label: string; serial: string | null; hours: number | null; updated: string | null }[];
}) {
  const [state, formAction, pending] = useActionState<PortalState, FormData>(updateEngineHours.bind(null, token, vesselId), {});
  return (
    <form action={formAction} className="space-y-3">
      {engines.map((e) => (
        <label key={e.id} className="block">
          <span className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-navy">{e.label}</span>
            <span className="text-xs text-muted">{e.hours !== null ? `${e.hours} h` : "no reading yet"}</span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            <input
              name={`hours-${e.id}`}
              type="number"
              inputMode="numeric"
              min={e.hours ?? 0}
              placeholder={e.hours !== null ? String(e.hours) : "Hours"}
              className={`${inputClass} mt-0`}
              aria-label={`New hours for ${e.label}`}
            />
            <span className="text-sm text-muted">h</span>
          </span>
          {(e.updated || e.serial) && <span className="mt-0.5 block text-[11px] text-muted">{[e.serial && `S/N ${e.serial}`, e.updated && `updated ${e.updated}`].filter(Boolean).join(" · ")}</span>}
        </label>
      ))}
      <FormMessage error={state.error} success={state.done ? "Thank you! The workshop has your new readings." : undefined} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Saving…" : "Update the hours"}
      </button>
    </form>
  );
}

/** "Make a claim" on a covered item: opens a short form under the warranty. */
export function ClaimForm({ token, warrantyId }: { token: string; warrantyId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<PortalState, FormData>(claimWarranty.bind(null, token, warrantyId), {});
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={secondaryButtonSm}>
        Make a claim
      </button>
    );
  return (
    <form action={formAction} className="space-y-3">
      <label className={labelClass}>
        What is wrong? *
        <textarea name="description" required rows={3} maxLength={4000} autoFocus placeholder="What happened, since when, and how the boat is used." className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Sending…" : "Send the claim"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButtonSm}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const TOPICS = [
  ["QUESTION", "A question"],
  ["QUOTE", "A quote (price)"],
  ["SERVICE", "A problem with my boat"],
] as const;

export function NewThreadForm({
  token,
  companies,
  vessels,
  defaults,
}: {
  token: string;
  companies: { slug: string; name: string }[];
  vessels: { id: string; name: string }[];
  defaults: { topic: string; vesselId?: string; subject?: string; company?: string };
}) {
  const [state, formAction, pending] = useActionState<PortalState, FormData>(startThread.bind(null, token), {});
  return (
    <form action={formAction} className="space-y-4">
      <fieldset>
        <legend className={labelClass}>I&apos;m writing about *</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {TOPICS.map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="topic" value={value} defaultChecked={defaults.topic === value} className="peer sr-only" />
              <span className="inline-block rounded-lg border border-border px-3 py-2 text-sm text-slate-700 peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-navy peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          To *
          <select name="company" defaultValue={defaults.company ?? companies[0]?.slug} className={inputClass}>
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Boat
          <select name="vesselId" defaultValue={vessels.find((v) => v.id === defaults.vesselId)?.id ?? ""} className={inputClass}>
            <option value="">— Not about a boat —</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={labelClass}>
        Subject *
        <input name="subject" required maxLength={140} defaultValue={defaults.subject} placeholder="e.g. Price for a 15x17 stainless propeller" className={inputClass} />
      </label>
      <label className={labelClass}>
        Message *
        <textarea name="body" required rows={5} maxLength={4000} placeholder="Tell us as much as you can: engine, model, serial number, what you need." className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full sm:w-auto`}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

export function ReplyForm({ token, threadId }: { token: string; threadId: string }) {
  const [state, formAction, pending] = useActionState<PortalState, FormData>(replyAsCustomer.bind(null, token, threadId), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.done) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={formAction} className="space-y-2">
      <label className="sr-only" htmlFor="reply">
        Your answer
      </label>
      <textarea id="reply" name="body" required rows={3} maxLength={4000} placeholder="Write your answer…" className={inputClass} />
      <FormMessage error={state.error} />
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}

export function ProfileForm({ token, customer }: { token: string; customer: { contactName: string | null; phone: string | null; email: string | null; address: string | null } }) {
  const [state, formAction, pending] = useActionState<PortalState, FormData>(updateMyDetails.bind(null, token), {});
  return (
    <form action={formAction} className="space-y-4">
      <label className={labelClass}>
        Contact person
        <input name="contactName" maxLength={120} defaultValue={customer.contactName ?? ""} autoComplete="name" className={inputClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Phone / WhatsApp
          <input name="phone" maxLength={60} defaultValue={customer.phone ?? ""} autoComplete="tel" className={inputClass} />
        </label>
        <label className={labelClass}>
          Email
          <input name="email" type="email" maxLength={200} defaultValue={customer.email ?? ""} autoComplete="email" className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        Address
        <textarea name="address" rows={2} maxLength={500} defaultValue={customer.address ?? ""} autoComplete="street-address" className={inputClass} />
      </label>
      <FormMessage error={state.error} success={state.done ? "Saved. Thank you!" : undefined} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full sm:w-auto`}>
        {pending ? "Saving…" : "Save my details"}
      </button>
    </form>
  );
}
