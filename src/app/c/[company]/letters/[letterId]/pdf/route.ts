import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { getLetter } from "@/lib/data/letters";
import { getCompanyProfile } from "@/lib/data/sales";
import { LetterPdf } from "@/lib/pdf/letter-pdf";
import { isBilingual } from "@/lib/pdf-language";

/** The letter as a PDF. ?download=1 saves it instead of opening it in the browser. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/letters/[letterId]/pdf">) {
  const { company, letterId } = await ctx.params;
  const { slug } = await requireModule(company, "offers");
  const [letter, profile] = await Promise.all([getLetter(slug, letterId), getCompanyProfile(slug)]);
  if (!letter) return new Response("Letter not found", { status: 404 });

  const print = { ...letter, offerNumber: letter.offer?.number ?? null };
  // LetterPdf renders a <Document>, which is what renderToBuffer expects.
  const element = createElement(LetterPdf, { slug, letter: print, company: profile, bilingual: await isBilingual(letter.customerId) }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${letter.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
