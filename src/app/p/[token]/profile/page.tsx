import { Suspense } from "react";
import { portalCustomer } from "@/lib/data/portal";
import { cardClass } from "@/components/ui";
import { PageHead } from "../_parts";
import { ProfileForm } from "../portal-forms";

async function Profile({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return null;
  return (
    <div className="max-w-xl">
      <PageHead title="My details" sub={`How we reach ${customer.name}. Keep them up to date so invoices and reminders reach you.`} />
      <div className={`${cardClass} p-5`}>
        <ProfileForm token={token} customer={{ contactName: customer.contactName, phone: customer.phone, email: customer.email, address: customer.address }} />
      </div>
      <p className="mt-4 text-xs text-muted">This page is private: anyone with this link can see your account, so don&apos;t share it. Ask us for a new link if needed.</p>
    </div>
  );
}

export default function PortalProfile({ params }: PageProps<"/p/[token]/profile">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Profile params={params} />
    </Suspense>
  );
}
