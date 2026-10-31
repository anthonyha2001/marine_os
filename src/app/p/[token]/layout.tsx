import { Suspense } from "react";
import type { Metadata } from "next";
import { InstallApp } from "@/components/install-app";
import { portalCustomer } from "@/lib/data/portal";
import { prisma } from "@/lib/prisma";
import { PortalNav } from "./portal-nav";

/** Installs as the customer's own app ("My boat"), opening on their account. */
export async function generateMetadata({ params }: LayoutProps<"/p/[token]">): Promise<Metadata> {
  const { token } = await params;
  return {
    manifest: `/p/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "My boat", statusBarStyle: "black-translucent" },
  };
}

async function Frame({ params, children }: { params: Promise<{ token: string }>; children: React.ReactNode }) {
  const { token } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return <p className="mx-auto max-w-5xl px-4 py-10 text-muted">This link is no longer valid. Please contact us for a new one.</p>;
  const unread = await prisma.portalThread.count({ where: { customerId: customer.id, customerUnread: true } });
  return (
    <>
      <PortalNav token={token} name={customer.name} unread={unread} />
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-12">{children}</div>
      <InstallApp title="Install your boat app" dismissKey="portal:install-dismissed" />
    </>
  );
}

/** The customer's own app: menu + page. Every page checks the token again before reading anything. */
export default function PortalTokenLayout({ params, children }: LayoutProps<"/p/[token]">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-5xl px-4 py-10 text-muted">Loading…</p>}>
      <Frame params={params}>{children}</Frame>
    </Suspense>
  );
}
