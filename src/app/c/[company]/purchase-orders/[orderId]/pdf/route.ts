import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { getPurchaseOrder } from "@/lib/data/purchase-orders";
import { getCompanyProfile } from "@/lib/data/sales";
import { PurchaseOrderPdf } from "@/lib/pdf/purchase-order-pdf";

/** The purchase order as a PDF. ?download=1 saves it instead of opening it in the browser. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/purchase-orders/[orderId]/pdf">) {
  const { company, orderId } = await ctx.params;
  const { slug } = await requireModule(company, "purchases");
  const [order, profile] = await Promise.all([getPurchaseOrder(slug, orderId), getCompanyProfile(slug)]);
  if (!order) return new Response("Purchase order not found", { status: 404 });

  const element = createElement(PurchaseOrderPdf, { slug, order, company: profile }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${order.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
