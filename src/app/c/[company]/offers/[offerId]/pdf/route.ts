import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { getCompanyProfile, getOffer } from "@/lib/data/sales";
import { OfferPdf } from "@/lib/pdf/offer-pdf";

/** The offer as a PDF. ?download=1 saves it instead of opening it in the browser. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/offers/[offerId]/pdf">) {
  const { company, offerId } = await ctx.params;
  const { slug } = await requireModule(company, "offers");
  const [offer, profile] = await Promise.all([getOffer(slug, offerId), getCompanyProfile(slug)]);
  if (!offer) return new Response("Offer not found", { status: 404 });

  // OfferPdf renders a <Document>, which is what renderToBuffer expects.
  const element = createElement(OfferPdf, { slug, offer, company: profile }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");
  const filename = `${offer.number}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
