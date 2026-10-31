import { Suspense } from "react";
import Link from "next/link";
import { portalCustomer, portalVessels } from "@/lib/data/portal";
import { COMPANIES, isCompanySlug } from "@/lib/permissions";
import { cardClass } from "@/components/ui";
import { PageHead } from "../../_parts";
import { NewThreadForm } from "../../portal-forms";

type Search = { topic?: string; boat?: string; subject?: string; company?: string };

async function NewMessage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Search> }) {
  const [{ token }, search] = await Promise.all([params, searchParams]);
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const vessels = await portalVessels(customer.id);
  const topic = search.topic === "QUOTE" || search.topic === "SERVICE" ? search.topic : "QUESTION";
  return (
    <>
      <Link href={`/p/${token}/messages`} className="text-sm text-brand hover:underline">
        ← Messages
      </Link>
      <div className="mt-3 max-w-2xl">
        <PageHead title={topic === "QUOTE" ? "Ask for a quote" : "New message"} sub="We usually answer within one working day. You'll see our answer in Messages." />
        <div className={`${cardClass} p-5`}>
          <NewThreadForm
            token={token}
            companies={[
              { slug: "xpert-marine", name: `${COMPANIES["xpert-marine"].name} — ${COMPANIES["xpert-marine"].tagline}` },
              { slug: "eliche-radice", name: `${COMPANIES["eliche-radice"].name} — ${COMPANIES["eliche-radice"].tagline}` },
            ]}
            vessels={vessels}
            defaults={{ topic, vesselId: search.boat, subject: search.subject, company: search.company && isCompanySlug(search.company) ? search.company : undefined }}
          />
        </div>
      </div>
    </>
  );
}

export default function PortalNewMessage({ params, searchParams }: PageProps<"/p/[token]/messages/new">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewMessage params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
