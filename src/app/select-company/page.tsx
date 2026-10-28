import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { COMPANIES, allowedCompanies, homePath } from "@/lib/permissions";
import { CompanyLogo } from "@/components/company-logo";
import { LogoutButton } from "@/components/logout-button";

export const metadata = { title: "Choose company · Marine OS" };

async function CompanyChoices() {
  const user = await requireUser();
  const companies = allowedCompanies(user);
  // Only admins have a choice to make; everyone else goes straight in.
  if (user.role !== "ADMIN") redirect(homePath(user));

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Welcome back, {user.name}</p>
          <h1 className="mt-1 text-2xl font-semibold text-navy">Which company are you working on?</h1>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {companies.map((slug) => (
          <Link
            key={slug}
            href={`/c/${slug}/dashboard`}
            className="group rounded-2xl border border-border bg-surface p-6 transition hover:border-brand hover:shadow-lg"
          >
            <div className="flex h-24 items-center">
              <CompanyLogo slug={slug} className="h-full w-auto max-w-full object-contain" />
            </div>
            <p className="mt-4 font-semibold text-navy">{COMPANIES[slug].name}</p>
            <p className="text-sm text-muted">{COMPANIES[slug].tagline}</p>
            <p className="mt-4 text-sm font-medium text-brand group-hover:underline">Open workspace →</p>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function SelectCompanyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <CompanyChoices />
      </Suspense>
    </main>
  );
}
