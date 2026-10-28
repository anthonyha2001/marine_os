import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/data/sales";
import { getVessel } from "@/lib/data/vessels";
import { getJobCard } from "@/lib/data/workshop";
import { JobCardPdf } from "@/lib/pdf/workshop-pdf";

/** The job card as a PDF, for the technician and the customer to sign. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/workshop/[jobId]/pdf">) {
  const { company, jobId } = await ctx.params;
  const { slug } = await requireModule(company, "workshop");
  const [job, profile] = await Promise.all([getJobCard(slug, jobId), getCompanyProfile(slug)]);
  if (!job) return new Response("Job card not found", { status: 404 });
  const vessel = job.vessel ? await getVessel(job.vessel.id) : null;
  const element = createElement(JobCardPdf, { slug, job, vessel, company: profile }) as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${job.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
