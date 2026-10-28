import { offerForCustomer } from "@/lib/data/portal";
import { offerPdfResponse } from "@/lib/portal-pdf";
import type { CompanySlug } from "@/lib/permissions";

export async function GET(request: Request, ctx: RouteContext<"/p/o/[shareToken]/pdf">) {
  const { shareToken } = await ctx.params;
  const offer = await offerForCustomer({ shareToken });
  if (!offer) return new Response("This link is no longer valid.", { status: 404 });
  return offerPdfResponse(offer.company.slug as CompanySlug, offer.id, new URL(request.url).searchParams.has("download"));
}
