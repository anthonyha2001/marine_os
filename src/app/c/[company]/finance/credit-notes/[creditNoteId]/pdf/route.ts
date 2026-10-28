import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { listCreditNotes } from "@/lib/data/ledger";
import { getCompanyProfile } from "@/lib/data/sales";
import { CreditNotePdf } from "@/lib/pdf/finance-pdf";

/** The credit note as a PDF. ?download=1 saves it. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/finance/credit-notes/[creditNoteId]/pdf">) {
  const { company, creditNoteId } = await ctx.params;
  const { slug } = await requireModule(company, "invoices");
  const [notes, profile] = await Promise.all([listCreditNotes(slug), getCompanyProfile(slug)]);
  const note = notes.find((c) => c.id === creditNoteId);
  if (!note) return new Response("Credit note not found", { status: 404 });

  const element = createElement(CreditNotePdf, { slug, note, company: profile }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${note.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
