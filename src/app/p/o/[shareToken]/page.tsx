import { Suspense } from "react";
import { offerForCustomer } from "@/lib/data/portal";
import type { CompanySlug } from "@/lib/permissions";
import { OfferView } from "../../offer-view";

/** An offer shared by link: the customer reads it and accepts or declines online. */
async function SharedOffer({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const offer = await offerForCustomer({ shareToken });
  if (!offer) return <p className="text-muted">This link is no longer valid. Please contact us.</p>;
  return (
    <OfferView
      slug={offer.company.slug as CompanySlug}
      offerId={offer.id}
      pdfHref={`/p/o/${shareToken}/pdf`}
      where={{ shareToken }}
      responded={{ at: offer.respondedAt, name: offer.respondedName }}
    />
  );
}

export default function SharedOfferPage({ params }: PageProps<"/p/o/[shareToken]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SharedOffer params={params} />
      </Suspense>
    </div>
  );
}
