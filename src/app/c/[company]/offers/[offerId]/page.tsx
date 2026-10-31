import { Suspense } from "react";
import { SendButton } from "@/components/send-button";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Hammer } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { createJobCardFromOffer } from "@/lib/actions/workshop";
import { reviseOffer } from "@/lib/actions/offers";
import { ShareOfferButton } from "@/components/share-link";
import { listJobCards } from "@/lib/data/workshop";
import { getOffer } from "@/lib/data/sales";
import { OFFER_STATUSES } from "@/lib/offers";
import { COMPANIES, can, canAccessModule, isAdmin } from "@/lib/permissions";
import { deleteOffer } from "@/lib/actions/offers";
import { DeleteButton } from "@/components/delete-button";
import { Modal } from "@/components/modal";
import { round2 } from "@/lib/money";
import { CustomInvoiceForm } from "../../invoices/custom-invoice-form";
import { PageHeader, secondaryButton } from "@/components/ui";
import { OfferEditor } from "../offer-editor";
import { offerEditorData } from "../editor-data";
import { InvoicingPanel } from "./invoicing-panel";
import { OfferToolbar } from "./offer-toolbar";

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function OfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; offerId: string }>;
  searchParams: Promise<{ saved?: string; invoiced?: string; invoice?: string }>;
}) {
  const [{ company, offerId }, { saved, invoiced, invoice }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "offers");
  const canWorkshop = canAccessModule(user, slug, "workshop");
  const [offer, data, jobs] = await Promise.all([getOffer(slug, offerId), offerEditorData(slug), canWorkshop ? listJobCards(slug) : []]);
  if (!offer) notFound();
  const offerJobs = jobs.filter((j) => j.offer?.id === offer.id);

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · ${OFFER_STATUSES[offer.status]}`}
        title={offer.number}
        description={[offer.customerName, offer.subject].filter(Boolean).join(" · ")}
        action={
          <div className="flex flex-wrap gap-2">
            <OfferToolbar companySlug={slug} offerId={offer.id} />
            {offer.status !== "REJECTED" && <SendButton companySlug={slug} kind="offer" id={offer.id} />}
            <form action={reviseOffer.bind(null, slug, offer.id)}>
              <button type="submit" className={secondaryButton} title="Copy this offer as Rev. n to change and send again">
                New revision
              </button>
            </form>
            {offer.status !== "REJECTED" && <ShareOfferButton companySlug={slug} offerId={offer.id} />}
            {canWorkshop && offer.status === "ACCEPTED" && (
              <form action={createJobCardFromOffer.bind(null, slug, offer.id)}>
                <button type="submit" className={secondaryButton}>
                  <Hammer className="size-4" aria-hidden /> Start job card
                </button>
              </form>
            )}
            {offer.invoiceCount === 0 && (isAdmin(user) || (offer.status === "DRAFT" && can(user, "deleteDrafts"))) && (
              <DeleteButton
                bordered
                action={deleteOffer.bind(null, slug, offer.id)}
                confirmText={`Delete offer ${offer.number}? It goes to the recycle bin and can be restored.`}
                title="Delete offer"
              />
            )}
          </div>
        }
      />
      {offer.respondedAt && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${offer.status === "ACCEPTED" ? "bg-green-50 text-success" : "bg-surface-2 text-navy"}`}>
          {offer.status === "ACCEPTED" ? "Accepted" : "Declined"} online by {offer.respondedName} on {offer.respondedAt.toLocaleDateString("en-GB")}
          {offer.customerNote && <span className="block text-muted">“{offer.customerNote}”</span>}
        </p>
      )}
      {offerJobs.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
          Job cards for this offer:
          {offerJobs.map((j) => (
            <Link key={j.id} href={`/c/${slug}/workshop/${j.id}`} className="font-mono text-xs text-brand hover:underline">
              {j.number}
            </Link>
          ))}
        </p>
      )}
      {invoiced && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
          {invoiced === "1" ? "Invoice created." : `${invoiced} invoices created.`} The offer is now marked as accepted.
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
          {saved === "copy" ? "Copy created as a new draft. Edit and save it." : "Offer saved."}
        </p>
      )}
      {canAccessModule(user, slug, "invoices") && (
        <>
          <div id="invoicing" className="scroll-mt-4">
            <InvoicingPanel companySlug={slug} offer={offer} />
          </div>
          {invoice === "custom" && (
            <Modal title={`Custom invoice for ${offer.number}`} closeHref={`/c/${slug}/offers/${offer.id}`} size="md">
              <CustomInvoiceForm
                key={crypto.randomUUID()}
                companySlug={slug}
                returnTo="offer"
                offers={[
                  {
                    id: offer.id,
                    number: offer.number,
                    customerName: offer.customerName,
                    subject: offer.subject,
                    totalHT: offer.totalHT,
                    totalTTC: offer.totalTTC,
                    remaining: round2(offer.totalTTC - offer.invoicedTTC),
                  },
                ]}
              />
            </Modal>
          )}
        </>
      )}
      {/* New key per render so the editor always shows what was just saved. */}
      <OfferEditor
        key={crypto.randomUUID()}
        companySlug={slug}
        companyName={data.company.legalName || COMPANIES[slug].name}
        catalogue={data.catalogue}
        customers={data.customers}
        vessels={data.vessels}
        clauses={data.clauses}
        defaultIntro={data.defaultIntro}
        defaultTerms={data.defaultTerms}
        offer={{
          ...offer,
          offerDate: iso(offer.offerDate),
          validUntil: iso(offer.validUntil),
        }}
      />
    </>
  );
}

export default function OfferDetailPage({ params, searchParams }: PageProps<"/c/[company]/offers/[offerId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <OfferPage params={params} searchParams={searchParams as Promise<{ saved?: string; invoiced?: string; invoice?: string }>} />
    </Suspense>
  );
}
