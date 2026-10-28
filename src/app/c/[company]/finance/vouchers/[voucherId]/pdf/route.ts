import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { listVouchers } from "@/lib/data/ledger";
import { getCompanyProfile } from "@/lib/data/sales";
import { VoucherPdf } from "@/lib/pdf/finance-pdf";

/** A payment / receipt / transfer voucher as a printable PDF. ?download=1 saves it. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/finance/vouchers/[voucherId]/pdf">) {
  const { company, voucherId } = await ctx.params;
  const { slug } = await requireModule(company, "accounting");
  const [vouchers, profile] = await Promise.all([listVouchers(slug), getCompanyProfile(slug)]);
  const voucher = vouchers.find((v) => v.id === voucherId);
  if (!voucher) return new Response("Voucher not found", { status: 404 });

  const element = createElement(VoucherPdf, { slug, voucher, company: profile }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${voucher.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
