import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { requireModule } from "@/lib/auth";
import { getCompanyProfile, getInvoice } from "@/lib/data/sales";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";
import { prisma } from "@/lib/prisma";
import { isBilingual } from "@/lib/pdf-language";

const MAX = 60;

/** Several invoices in one PDF (in the order chosen), to print or download at once. ?download=1 saves it. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/invoices/bulk-pdf">) {
  const { company } = await ctx.params;
  const { slug } = await requireModule(company, "invoices");
  const url = new URL(request.url);
  const ids = [...new Set((url.searchParams.get("ids") ?? "").split(",").filter(Boolean))].slice(0, MAX);
  if (!ids.length) return new Response("No invoices chosen", { status: 400 });

  const profile = await getCompanyProfile(slug);
  const owners = new Map((await prisma.invoice.findMany({ where: { id: { in: ids } }, select: { id: true, customerId: true } })).map((o) => [o.id, o.customerId]));
  const merged = await PDFDocument.create();
  const numbers: string[] = [];
  for (const id of ids) {
    // Only this company's invoices: another company's id is skipped.
    const invoice = await getInvoice(slug, id);
    if (!invoice) continue;
    const element = createElement(InvoicePdf, { slug, invoice, company: profile, bilingual: await isBilingual(owners.get(id)) }) as Parameters<typeof renderToBuffer>[0];
    const one = await PDFDocument.load(await renderToBuffer(element));
    for (const page of await merged.copyPages(one, one.getPageIndices())) merged.addPage(page);
    numbers.push(invoice.number);
  }
  if (!numbers.length) return new Response("Invoices not found", { status: 404 });

  const name = numbers.length === 1 ? numbers[0] : `invoices-${numbers.length}`;
  return new Response(new Uint8Array(await merged.save()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
