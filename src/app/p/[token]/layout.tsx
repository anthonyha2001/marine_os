import { Suspense } from "react";
import { portalCustomer } from "@/lib/data/portal";
import { prisma } from "@/lib/prisma";
import { PortalNav } from "./portal-nav";

async function Frame({ params, children }: { params: Promise<{ token: string }>; children: React.ReactNode }) {
  const { token } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return <p className="mx-auto max-w-5xl px-4 py-10 text-muted">This link is no longer valid. Please contact us for a new one.</p>;
  const unread = await prisma.portalThread.count({ where: { customerId: customer.id, customerUnread: true } });
  return (
    <>
      <PortalNav token={token} name={customer.name} unread={unread} />
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-12">{children}</div>
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
