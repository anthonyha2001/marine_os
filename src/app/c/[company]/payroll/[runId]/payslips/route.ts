import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { getPayrollRun, listEmployees } from "@/lib/data/payroll";
import { getCompanyProfile } from "@/lib/data/sales";
import { PayslipsPdf } from "@/lib/pdf/payroll-pdf";

/** Every employee's payslip, one page each. ?download=1 saves it. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/payroll/[runId]/payslips">) {
  const { company, runId } = await ctx.params;
  const { slug } = await requireModule(company, "payroll");
  const [run, profile, staff] = await Promise.all([getPayrollRun(slug, runId), getCompanyProfile(slug), listEmployees(slug)]);
  if (!run) return new Response("Payroll not found", { status: 404 });
  const element = createElement(PayslipsPdf, { slug, run, company: profile, employees: new Map(staff.map((e) => [e.id, e])) }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${run.number} payslips.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
