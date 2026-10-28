"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { NavGroup } from "@/lib/navigation";
import { FeedbackProvider } from "@/components/feedback";
import { KeyboardShortcuts } from "../keyboard-shortcuts";
import { CommandPalette } from "./command-palette";
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
  children,
}: {
  base: string;
  allGroups: NavGroup[];
  sidebarGroups: NavGroup[];
  company: CompanyOption;
  companies: CompanyOption[];
  user: { name: string; email: string; roleLabel: string };
  notices: Notice[];
  children: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div data-company={company.slug} className="min-h-screen bg-background">
    <FeedbackProvider>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar base={base} groups={sidebarGroups} logo={company.logo} companyName={company.name} />
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

      <div className="lg:pl-64">
        <Topbar
          base={base}
          groups={allGroups}
          company={company}
          companies={companies}
          user={user}
          notices={notices}
          onMenu={() => setDrawer(true)}
        />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <CommandPalette companySlug={company.slug} base={base} groups={allGroups} />
      <KeyboardShortcuts base={base} groups={allGroups} />
    </FeedbackProvider>
    </div>
  );
}
