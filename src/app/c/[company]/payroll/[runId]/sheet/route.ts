import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { getPayrollRun } from "@/lib/data/payroll";
import { getCompanyProfile } from "@/lib/data/sales";
import { PayrollSheetPdf } from "@/lib/pdf/payroll-pdf";

/** The payroll signature sheet as a PDF. ?download=1 saves it. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/payroll/[runId]/sheet">) {
  const { company, runId } = await ctx.params;
  const { slug } = await requireModule(company, "payroll");
  const [run, profile] = await Promise.all([getPayrollRun(slug, runId), getCompanyProfile(slug)]);
  if (!run) return new Response("Payroll not found", { status: 404 });
  const element = createElement(PayrollSheetPdf, { slug, run, company: profile }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${run.number} payroll sheet.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
