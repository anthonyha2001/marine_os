import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/data/sales";
import { listWarranties } from "@/lib/data/workshop";
import { WarrantyPdf } from "@/lib/pdf/workshop-pdf";

/** Warranty certificate as a PDF. ?download=1 saves it. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/warranties/[warrantyId]/pdf">) {
  const { company, warrantyId } = await ctx.params;
  const { slug } = await requireModule(company, "workshop");
  const [warranties, profile] = await Promise.all([listWarranties(slug), getCompanyProfile(slug)]);
  const warranty = warranties.find((w) => w.id === warrantyId);
  if (!warranty) return new Response("Warranty not found", { status: 404 });
  const element = createElement(WarrantyPdf, { slug, warranty, company: profile }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${warranty.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
