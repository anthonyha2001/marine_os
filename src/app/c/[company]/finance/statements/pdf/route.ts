import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/data/sales";
import { loadStatements } from "@/lib/data/statements";
import { StatementPdf } from "@/lib/pdf/finance-pdf";
import { periodFrom } from "../../finance-ui";

/** Statement of account as a PDF: ?type=customer|supplier&party=&from=&to= (&download=1). */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/finance/statements/pdf">) {
  const { company } = await ctx.params;
  const { slug } = await requireModule(company, "accounting");
  const sp = new URL(request.url).searchParams;
  const type = sp.get("type") === "supplier" ? "SUPPLIER" : "CUSTOMER";
  const { period } = periodFrom({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const [{ partner, result }, profile] = await Promise.all([loadStatements(slug, type, sp.get("party") ?? undefined, period), getCompanyProfile(slug)]);
  if (!partner || !result) return new Response("Choose a customer or supplier", { status: 404 });

  const element = createElement(StatementPdf, {
    slug,
    company: profile,
    data: { partyLabel: type === "SUPPLIER" ? "Supplier" : "Customer", partyName: partner.name, from: period.from, to: period.to ?? new Date(), ...result },
  }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const safe = partner.name.replace(/[^\w\- ]+/g, "").trim() || "statement";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${sp.has("download") ? "attachment" : "inline"}; filename="Statement - ${safe}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
