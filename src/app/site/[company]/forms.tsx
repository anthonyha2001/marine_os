"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { bookFromWebsite, sendWebsiteMessage, type PublicFormState } from "@/lib/actions/website";

const field = "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-[var(--site-accent)] focus:ring-4 focus:ring-[var(--site-accent-soft)]";
const label = "block text-sm font-medium text-slate-700";
const button = "inline-flex w-full items-center justify-center rounded-full bg-[var(--site-accent)] px-6 py-3.5 font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60 sm:w-auto";

/** Field only bots fill in: a filled one is accepted silently and dropped. */
function Trap() {
  return (
    <div className="absolute -left-[9999px]" aria-hidden>
      <label>
        Website <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

function Sent({ title, text }: { title: string; text: string }) {
  return (
    <div role="status" className="rounded-2xl border border-green-200 bg-green-50 p-6 text-green-900">
      <CheckCircle2 className="size-8 text-green-600" aria-hidden />
      <p className="mt-3 text-lg font-semibold">{title}</p>
      <p className="mt-1 text-green-800">{text}</p>
    </div>
  );
}

/** Contact form; with a product it becomes a quote request. */
export function ContactForm({ slug, product, message, sentTitle }: { slug: string; product?: { id: string; name: string }; message?: string; sentTitle?: string }) {
  const [state, action, pending] = useActionState<PublicFormState, FormData>(sendWebsiteMessage.bind(null, slug), {});
  if (state.sent) return <Sent title={sentTitle ?? (product ? "Quote request sent" : "Message sent")} text="Thank you. We'll get back to you shortly." />;
  return (
    <form action={action} className="relative space-y-4">
      <Trap />
      {product && <input type="hidden" name="productId" value={product.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Your name *
          <input name="name" required maxLength={120} autoComplete="name" className={field} />
        </label>
        <label className={label}>
          Phone
          <input name="phone" type="tel" maxLength={60} autoComplete="tel" className={field} />
        </label>
      </div>
      <label className={label}>
        Email
        <input name="email" type="email" maxLength={200} autoComplete="email" className={field} />
      </label>
      <label className={label}>
        {product ? "What do you need? (quantity, boat, engine…)" : "Message *"}
        <textarea name="message" required rows={5} maxLength={3000} defaultValue={product ? `I'd like a quote for ${product.name}.` : (message ?? "")} className={field} />
      </label>
      <p className="text-xs text-slate-500">Give us a phone number or an email so we can reply.</p>
      {state.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Sending…" : product ? "Ask for a quote" : "Send message"}
      </button>
    </form>
  );
}

/** Booking request: lands in Marine OS as an appointment to confirm. */
export function BookingForm({ slug, slots, minDate }: { slug: string; slots: string[]; minDate: string }) {
  const [state, action, pending] = useActionState<PublicFormState, FormData>(bookFromWebsite.bind(null, slug), {});
  if (state.sent) return <Sent title="Booking request received" text="We'll call you to confirm the date and time." />;
  return (
    <form action={action} className="relative space-y-4">
      <Trap />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Your name *
          <input name="name" required maxLength={120} autoComplete="name" className={field} />
        </label>
        <label className={label}>
          Phone *
          <input name="phone" type="tel" required maxLength={60} autoComplete="tel" className={field} />
        </label>
        <label className={label}>
          Email
          <input name="email" type="email" maxLength={200} autoComplete="email" className={field} />
        </label>
        <label className={label}>
          Boat (name, model or engine)
          <input name="boat" maxLength={200} className={field} />
        </label>
        <label className={label}>
          Preferred date *
          <input name="date" type="date" required min={minDate} defaultValue={minDate} className={field} />
        </label>
        <label className={label}>
          Preferred time *
          <select name="time" required defaultValue="09:00" className={field}>
            {slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={label}>
        What do you need? *
        <textarea name="reason" required rows={4} maxLength={1500} className={field} placeholder="e.g. 100-hour service on twin outboards, vibration at high speed…" />
      </label>
      <p className="text-xs text-slate-500">Monday to Saturday. We call you to confirm.</p>
      {state.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Sending…" : "Request this booking"}
      </button>
    </form>
  );
}
