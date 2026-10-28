import { createElement } from "react";
import { notFound } from "next/navigation";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { getSale } from "@/lib/data/pos";
import { getCompanyProfile } from "@/lib/data/sales";
import { PosInvoicePdf } from "@/lib/pdf/pos-invoice-pdf";
import { hasPos } from "@/lib/pos";

/** A4 tax invoice for a counter sale. ?download=1 saves it. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/pos/sales/[saleId]/invoice">) {
  const { company, saleId } = await ctx.params;
  const { slug } = await requireModule(company, "sales");
  if (!hasPos(slug)) notFound();
  const [sale, profile] = await Promise.all([getSale(slug, saleId), getCompanyProfile(slug)]);
  if (!sale) return new Response("Sale not found", { status: 404 });

  const element = createElement(PosInvoicePdf, { slug, sale, company: profile }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${sale.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
