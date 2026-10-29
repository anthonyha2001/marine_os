import { FileText } from "lucide-react";
import { dayFormat, businessToday } from "@/lib/dates";
import { getOffer } from "@/lib/data/sales";
import { formatMoney } from "@/lib/money";
import { COMPANIES, type CompanySlug } from "@/lib/permissions";
import { Badge, cardClass, secondaryButton } from "@/components/ui";
import { OfferResponse } from "./offer-response";

/** The offer as the customer sees it: summary, PDF, and accept / decline while it's open. */
export async function OfferView({
  slug,
  offerId,
  pdfHref,
  where,
  responded,
}: {
  slug: CompanySlug;
  offerId: string;
  pdfHref: string;
  where: { shareToken: string } | { portalToken: string; offerId: string };
  responded: { at: Date | null; name: string | null };
}) {
  const offer = await getOffer(slug, offerId);
  if (!offer) return <p className="text-muted">This offer is no longer available.</p>;
  const expired = offer.validUntil.toISOString().slice(0, 10) < businessToday();
  const open = (offer.status === "SENT" || offer.status === "DRAFT") && !expired;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-brand">{COMPANIES[slug].name} · Offer</p>
        <h1 className="mt-0.5 text-2xl font-semibold text-navy">{offer.number}</h1>
        <p className="mt-1 text-sm text-muted">
          For {offer.customerName}
          {offer.subject && ` · ${offer.subject}`} · dated {dayFormat.format(offer.offerDate)} · valid until {dayFormat.format(offer.validUntil)}
        </p>
        <div className="mt-2">
          {offer.status === "ACCEPTED" && <Badge tone="green">Accepted{responded.name ? ` by ${responded.name}` : ""}</Badge>}
          {offer.status === "REJECTED" && <Badge tone="gray">Declined</Badge>}
          {open && <Badge tone="blue">Waiting for your answer</Badge>}
          {expired && offer.status !== "ACCEPTED" && offer.status !== "REJECTED" && <Badge tone="amber">Expired — contact us for an update</Badge>}
        </div>
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Amount excl. VAT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {offer.lines.map((l) =>
              l.kind === "SECTION" ? (
                <tr key={l.id} className="bg-surface-2">
                  <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-navy">
                    {l.title}
                  </td>
                </tr>
              ) : (
                <tr key={l.id}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-navy">{l.title}</span>
                    {l.description && <span className="block text-xs text-muted">{l.description}</span>}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right">{l.quantity}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(l.lineTotal)}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        <dl className="space-y-1 border-t border-border p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Total excl. VAT</dt>
            <dd className="tabular">{formatMoney(offer.totalHT)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">VAT</dt>
            <dd className="tabular">{offer.applyVat ? formatMoney(offer.vatAmount) : "Exempt"}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold text-navy">
            <dt>Total</dt>
            <dd className="tabular">{formatMoney(offer.totalTTC)}</dd>
          </div>
        </dl>
      </div>

      <a href={pdfHref} target="_blank" rel="noopener" className={secondaryButton}>
        <FileText className="size-4" aria-hidden /> Full offer (PDF) with terms
      </a>

      {open && (
        <section className={`${cardClass} p-5`}>
          <h2 className="font-semibold text-navy">Your answer</h2>
          <p className="mb-4 mt-1 text-sm text-muted">By accepting, you agree to the offer and its terms as shown in the PDF.</p>
          <OfferResponse where={where} />
        </section>
      )}
      {responded.at && !open && (
        <p className={`rounded-lg border px-4 py-3 text-sm ${offer.status === "ACCEPTED" ? "border-green-200 bg-green-50 text-success" : "border-border bg-surface-2 text-navy"}`}>
          {offer.status === "ACCEPTED" ? "Thank you — your acceptance was received" : "Your answer was received"} on {dayFormat.format(responded.at)}
          {responded.name ? ` (${responded.name})` : ""}. We&apos;ll be in touch.
        </p>
      )}
    </div>
  );
}
