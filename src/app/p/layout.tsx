import type { Metadata } from "next";
import { CompanyLogo } from "@/components/company-logo";
import { FeedbackProvider } from "@/components/feedback";

export const metadata: Metadata = { title: "Customer portal · Xpert Marine & Eliche Radice", robots: { index: false, follow: false } };

/** Customer-facing pages (private links): both companies' logos, no staff menus. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-company="xpert-marine" className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <CompanyLogo slug="xpert-marine" className="h-9 w-auto" />
            <span className="h-6 w-px bg-border" aria-hidden />
            <CompanyLogo slug="eliche-radice" className="h-9 w-auto" />
          </div>
          <span className="text-xs text-muted">Customer portal</span>
        </div>
      </header>
      <FeedbackProvider>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </FeedbackProvider>
    </div>
  );
}
