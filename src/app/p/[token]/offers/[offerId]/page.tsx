import { Suspense } from "react";
import Link from "next/link";
import { offerForCustomer } from "@/lib/data/portal";
import type { CompanySlug } from "@/lib/permissions";
import { OfferView } from "../../../offer-view";

async function PortalOffer({ params }: { params: Promise<{ token: string; offerId: string }> }) {
  const { token, offerId } = await params;
  const offer = await offerForCustomer({ portalToken: token, offerId });
  if (!offer) return <p className="text-muted">This link is no longer valid. Please contact us.</p>;
  return (
    <>
      <Link href={`/p/${token}/offers`} className="text-sm text-brand hover:underline">
        ← Offers
      </Link>
      <div className="mt-4">
        <OfferView
          slug={offer.company.slug as CompanySlug}
          offerId={offer.id}
          pdfHref={`/p/${token}/offers/${offer.id}/pdf`}
          where={{ portalToken: token, offerId: offer.id }}
          responded={{ at: offer.respondedAt, name: offer.respondedName }}
        />
      </div>
    </>
  );
}

export default function PortalOfferPage({ params }: PageProps<"/p/[token]/offers/[offerId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <PortalOffer params={params} />
    </Suspense>
  );
}
