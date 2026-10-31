"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { CheckCircle2 } from "lucide-react";
import { askForMyLink, createMyAccount, type AccountState } from "@/lib/actions/website-account";

const field =
  "mt-1.5 block w-full rounded-[var(--er-radius)] border border-black/10 bg-white px-4 py-3 text-base text-[var(--er-navy)] outline-none transition focus:border-[var(--er-gold)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--er-gold)_20%,transparent)]";
const label = "block text-sm font-medium text-[var(--er-navy)]";
const submit = "er-glow w-full rounded-[var(--er-radius)] bg-[var(--er-gold)] px-6 py-3.5 font-semibold text-[var(--er-navy)] disabled:opacity-60";

function Trap() {
  return (
    <div className="absolute -left-[9999px]" aria-hidden>
      <label>
        Website <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

function Requested() {
  return (
    <div role="status" className="rounded-[var(--er-radius)] border border-green-200 bg-green-50 p-6 text-green-900">
      <CheckCircle2 className="size-8 text-green-600" aria-hidden />
      <p className="mt-3 text-lg font-semibold">Thank you!</p>
      <p className="mt-1 text-green-800">If you&apos;re one of our customers, we&apos;ll send the link to your account by WhatsApp shortly. Not yet a customer? Create your account instead.</p>
    </div>
  );
}

/** "I'm a customer" (send me my link) and "New here" (create my account), side by side. */
export function AccountForms({ slug }: { slug: string }) {
  // "Create my account" buttons link to #new: open that tab.
  const hash = useSyncExternalStore(
    (cb) => (window.addEventListener("hashchange", cb), () => window.removeEventListener("hashchange", cb)),
    () => window.location.hash,
    () => "",
  );
  const [picked, setTab] = useState<"new" | "known" | null>(null);
  const tab = picked ?? (hash === "#new" ? "new" : "known");
  const [ask, askAction, asking] = useActionState<AccountState, FormData>(askForMyLink.bind(null, slug), {});
  const [create, createAction, creating] = useActionState<AccountState, FormData>(createMyAccount.bind(null, slug), {});

  return (
    <div className="er-reveal rounded-[var(--er-radius)] bg-white p-6 shadow-[0_30px_70px_-40px_rgb(10_25_41/0.5)] ring-1 ring-black/5 sm:p-8" data-shown="">
      <div className="mb-6 grid grid-cols-2 rounded-[var(--er-radius)] bg-[var(--er-cream)] p-1 text-sm font-semibold" role="tablist">
        {(
          [
            ["known", "I'm a customer"],
            ["new", "I'm new here"],
          ] as const
        ).map(([key, text]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`rounded-[calc(var(--er-radius)-4px)] px-4 py-2.5 transition ${tab === key ? "bg-[var(--er-navy)] text-white shadow" : "text-[var(--er-navy)]/70"}`}>
            {text}
          </button>
        ))}
      </div>

      {tab === "known" ? (
        ask.requested ? (
          <Requested />
        ) : (
          <form action={askAction} className="relative space-y-4">
            <Trap />
            <p className="text-sm text-[var(--er-ink)]/70">Your account has a private link. Enter the phone number or email you gave us and we&apos;ll send it to you.</p>
            <label className={label}>
              Phone or email *
              <input name="who" required maxLength={200} autoComplete="tel" className={field} placeholder="e.g. 03 123 456" />
            </label>
            {ask.error && <p className="rounded-[var(--er-radius)] bg-red-50 px-4 py-3 text-sm text-red-700">{ask.error}</p>}
            <button type="submit" disabled={asking} className={submit}>
              {asking ? "Sending…" : "Send me my link"}
            </button>
          </form>
        )
      ) : create.requested ? (
        <Requested />
      ) : (
        <form action={createAction} className="relative space-y-4">
          <Trap />
          <p className="text-sm text-[var(--er-ink)]/70">Create your account in a minute and enter your app right away.</p>
          <label className={label}>
            Your name (or company) *
            <input name="name" required maxLength={120} autoComplete="name" className={field} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Phone / WhatsApp *
              <input name="phone" required maxLength={60} type="tel" autoComplete="tel" className={field} />
            </label>
            <label className={label}>
              Email
              <input name="email" type="email" maxLength={200} autoComplete="email" className={field} />
            </label>
          </div>
          <label className={label}>
            Your boat&apos;s name
            <input name="boat" maxLength={120} className={field} placeholder="Optional" />
          </label>
          {create.error && <p className="rounded-[var(--er-radius)] bg-red-50 px-4 py-3 text-sm text-red-700">{create.error}</p>}
          <button type="submit" disabled={creating} className={submit}>
            {creating ? "Creating…" : "Create my account"}
          </button>
        </form>
      )}
    </div>
  );
}
