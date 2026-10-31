import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireCompany } from "@/lib/auth";
import { noticesFor } from "@/lib/data/notices";
import { navFor, visibleNav } from "@/lib/navigation";
import { COMPANIES, ROLE_LABELS, allowedCompanies } from "@/lib/permissions";
import { AppShell } from "./shell/app-shell";

async function Shell({ params, children }: { params: Promise<{ company: string }>; children: React.ReactNode }) {
  const { company } = await params;
  const { user, slug } = await requireCompany(company);
  const groups = navFor(user, slug);
  const [notices, jar] = await Promise.all([noticesFor(user, slug), cookies()]);
  const option = (s: keyof typeof COMPANIES) => ({ slug: s, name: COMPANIES[s].name, logo: COMPANIES[s].mark });

  return (
    <AppShell
      base={`/c/${slug}`}
      allGroups={groups}
      sidebarGroups={visibleNav(groups)}
      company={option(slug)}
      companies={allowedCompanies(user).map(option)}
      user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
      notices={notices}
      initialCollapsed={jar.get("sidebar")?.value === "collapsed"}
    >
      {children}
    </AppShell>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-background lg:pl-60">
      <div className="fixed inset-y-0 left-0 hidden w-60 bg-sidebar lg:block" />
      <div className="h-14 border-b border-border bg-surface" />
      <div className="mx-auto max-w-[1400px] space-y-4 px-8 py-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-200/70" />
      </div>
    </div>
  );
}

export default function CompanyLayout({ params, children }: LayoutProps<"/c/[company]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}
