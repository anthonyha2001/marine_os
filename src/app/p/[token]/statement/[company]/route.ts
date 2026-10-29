import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { businessToday } from "@/lib/dates";
import { portalCustomer } from "@/lib/data/portal";
import { getCompanyProfile } from "@/lib/data/sales";
import { loadStatements } from "@/lib/data/statements";
import { StatementPdf } from "@/lib/pdf/finance-pdf";
import { isCompanySlug } from "@/lib/permissions";

/** The customer's statement of account with one company, this year to date (private link). */
export async function GET(_request: Request, ctx: RouteContext<"/p/[token]/statement/[company]">) {
  const { token, company } = await ctx.params;
  const customer = await portalCustomer(token);
  if (!customer || !isCompanySlug(company)) return new Response("This link is no longer valid.", { status: 404 });
  const today = businessToday();
  const period = { from: new Date(`${today.slice(0, 4)}-01-01T00:00:00Z`), to: new Date(`${today}T23:59:59Z`) };
  const [{ partner, result }, profile] = await Promise.all([loadStatements(company, "CUSTOMER", customer.id, period), getCompanyProfile(company)]);
  if (!partner || !result) return new Response("Not found", { status: 404 });
  const element = createElement(StatementPdf, {
    slug: company,
    company: profile,
    data: { partyLabel: "Customer", partyName: partner.name, from: period.from, to: period.to, ...result },
  }) as Parameters<typeof renderToBuffer>[0];
  return new Response(new Uint8Array(await renderToBuffer(element)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Statement.pdf"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}
