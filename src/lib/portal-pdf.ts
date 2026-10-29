import "server-only";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCompanyProfile, getInvoice, getOffer } from "@/lib/data/sales";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";
import { OfferPdf } from "@/lib/pdf/offer-pdf";
import type { CompanySlug } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isBilingual } from "@/lib/pdf-language";

// PDFs served to customers through their private links (the routes check the link first).

function pdfResponse(pdf: Buffer, filename: string, download: boolean) {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function offerPdfResponse(slug: CompanySlug, offerId: string, download: boolean) {
  const [offer, profile] = await Promise.all([getOffer(slug, offerId), getCompanyProfile(slug)]);
  if (!offer) return new Response("Not found", { status: 404 });
  const element = createElement(OfferPdf, { slug, offer, company: profile, bilingual: await isBilingual(offer.customerId) }) as Parameters<typeof renderToBuffer>[0];
  return pdfResponse(await renderToBuffer(element), `${offer.number}.pdf`, download);
}

export async function invoicePdfResponse(slug: CompanySlug, invoiceId: string, download: boolean) {
  const [invoice, profile] = await Promise.all([getInvoice(slug, invoiceId), getCompanyProfile(slug)]);
  if (!invoice) return new Response("Not found", { status: 404 });
  const owner = await prisma.invoice.findUnique({ where: { id: invoice.id }, select: { customerId: true } });
  const element = createElement(InvoicePdf, { slug, invoice, company: profile, bilingual: await isBilingual(owner?.customerId) }) as Parameters<typeof renderToBuffer>[0];
  return pdfResponse(await renderToBuffer(element), `${invoice.number}.pdf`, download);
}
