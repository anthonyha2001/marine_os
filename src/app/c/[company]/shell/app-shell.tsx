"use client";

import { Suspense, useState } from "react";
import { X } from "lucide-react";
import type { NavGroup } from "@/lib/navigation";
import { FeedbackProvider } from "@/components/feedback";
import { InstallApp } from "@/components/install-app";
import { KeyboardShortcuts } from "../keyboard-shortcuts";
import { CommandPalette } from "./command-palette";
import { Flash } from "./flash";
import { PayDialog } from "./pay-dialog";
import { RowKeys } from "./row-keys";
import { SectionTabs } from "./section-tabs";
import { Sidebar } from "./sidebar";
import { Topbar, type Notice } from "./topbar";

type CompanyOption = { slug: string; name: string; logo: string };

/** Workspace frame: fixed sidebar (drawer on mobile), sticky top bar, content. */
export function AppShell({
  base,
  allGroups,
  sidebarGroups,
  company,
  companies,
  user,
  notices,
  initialCollapsed,
  canPay,
  tabCounts,
  children,
}: {
  base: string;
  allGroups: NavGroup[];
  sidebarGroups: NavGroup[];
  company: CompanyOption;
  companies: CompanyOption[];
  user: { name: string; email: string; roleLabel: string };
  notices: Notice[];
  initialCollapsed: boolean;
  canPay: boolean; // accounting: payment pop-ups (?pay=…) open on any page
  tabCounts: Record<string, number>; // red counters on page tabs, by page path (e.g. unread customer messages)
  children: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // A cookie, so the server draws the menu at the right width (no jump on load).
    document.cookie = `sidebar=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div data-company={company.slug} className="min-h-screen bg-background">
    <FeedbackProvider>
      <aside className={`fixed inset-y-0 left-0 z-40 hidden lg:block ${collapsed ? "w-[72px]" : "w-60"}`}>
        <Sidebar base={base} groups={sidebarGroups} logo={company.logo} companyName={company.name} collapsed={collapsed} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-deep/50" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-2xl">
            <Sidebar base={base} groups={sidebarGroups} logo={company.logo} companyName={company.name} onNavigate={() => setDrawer(false)} />
            <button
              type="button"
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-3 rounded-lg bg-white/10 p-1.5 text-white"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
          </aside>
        </div>
      )}

      <div className={collapsed ? "lg:pl-[72px]" : "lg:pl-60"}>
        <Topbar
          base={base}
          groups={allGroups}
          company={company}
          companies={companies}
          user={user}
          notices={notices}
          onMenu={() => setDrawer(true)}
          collapsed={collapsed}
          onToggleMenu={toggle}
        />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <SectionTabs base={base} groups={sidebarGroups} counts={tabCounts} />
          {children}
        </main>
      </div>

      <CommandPalette companySlug={company.slug} base={base} groups={allGroups} />
      <KeyboardShortcuts base={base} groups={allGroups} />
      <RowKeys />
      <Suspense>
        <Flash />
      </Suspense>
      {canPay && (
        <Suspense>
          <PayDialog companySlug={company.slug} />
        </Suspense>
      )}
      <InstallApp />
    </FeedbackProvider>
    </div>
  );
}
