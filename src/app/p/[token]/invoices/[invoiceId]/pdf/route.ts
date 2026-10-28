import { prisma } from "@/lib/prisma";
import { portalCustomer } from "@/lib/data/portal";
import { invoicePdfResponse } from "@/lib/portal-pdf";
import type { CompanySlug } from "@/lib/permissions";

/** One of the customer's own invoices, as a PDF. */
export async function GET(request: Request, ctx: RouteContext<"/p/[token]/invoices/[invoiceId]/pdf">) {
  const { token, invoiceId } = await ctx.params;
  const customer = await portalCustomer(token);
  if (!customer) return new Response("This link is no longer valid.", { status: 404 });
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, customerId: customer.id }, select: { id: true, company: { select: { slug: true } } } });
  if (!invoice) return new Response("Not found", { status: 404 });
  return invoicePdfResponse(invoice.company.slug as CompanySlug, invoice.id, new URL(request.url).searchParams.has("download"));
}
