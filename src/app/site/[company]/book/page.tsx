import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck, Phone } from "lucide-react";
import { businessToday } from "@/lib/dates";
import { APPOINTMENT_SLOTS } from "@/lib/data/portal";
import { PageHero } from "../blocks";
import { BookingForm } from "../forms";
import { siteContext } from "../site";
import { ElicheBook } from "../_eliche/pages";

export const metadata: Metadata = { title: "Book a service" };

async function Book({ params }: { params: Promise<{ company: string }> }) {
  const { site, base, visible } = await siteContext(params);
  if (!visible) return null;
  if (!site.showBooking) notFound();
  const tomorrow = new Date(`${businessToday()}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (site.slug === "eliche-radice") return <ElicheBook site={site} base={base} slots={APPOINTMENT_SLOTS} minDate={tomorrow.toISOString().slice(0, 10)} />;
  return (
    <>
      <PageHero eyebrow="Book a service" title="Book your boat in" text="Choose a day and time that suits you. We'll call to confirm and prepare everything before you arrive." />
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <BookingForm slug={site.slug} slots={APPOINTMENT_SLOTS} minDate={tomorrow.toISOString().slice(0, 10)} />
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl bg-[var(--site-accent-soft)] p-6">
            <CalendarCheck className="size-7 text-[var(--site-accent)]" aria-hidden />
            <p className="mt-3 font-semibold text-[var(--site-dark)]">How it works</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
              <li>Send your request with the day and time you prefer.</li>
              <li>We call you to confirm.</li>
              <li>Bring your boat, or we come to the marina.</li>
            </ol>
          </div>
          {site.phone && (
            <a href={`tel:${site.phone}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-5 hover:border-[var(--site-accent)]">
              <Phone className="size-5 text-[var(--site-accent)]" aria-hidden />
              <span>
                <span className="block text-sm text-slate-500">Prefer to call?</span>
                <span className="font-semibold text-[var(--site-dark)]">{site.phone}</span>
              </span>
            </a>
          )}
        </aside>
      </section>
    </>
  );
}

export default function BookPage({ params }: PageProps<"/site/[company]/book">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Book params={params} />
    </Suspense>
  );
}
