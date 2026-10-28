import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { getCompanyProfile, getInvoice } from "@/lib/data/sales";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";

/** The invoice as a PDF. ?download=1 saves it instead of opening it in the browser. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/invoices/[invoiceId]/pdf">) {
  const { company, invoiceId } = await ctx.params;
  const { slug } = await requireModule(company, "invoices");
  const [invoice, profile] = await Promise.all([getInvoice(slug, invoiceId), getCompanyProfile(slug)]);
  if (!invoice) return new Response("Invoice not found", { status: 404 });

  const element = createElement(InvoicePdf, { slug, invoice, company: profile }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
