import { requireModule } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** A supplier's file: opens in the browser (photos, PDF), or downloads with ?download. */
export async function GET(request: Request, ctx: RouteContext<"/c/[company]/suppliers/documents/[id]">) {
  const { company, id } = await ctx.params;
  await requireModule(company, "suppliers");
  const doc = await prisma.supplierDocument.findUnique({ where: { id }, select: { name: true, contentType: true, data: true } });
  if (!doc) return new Response("Not found", { status: 404 });
  const download = new URL(request.url).searchParams.has("download");
  const viewable = doc.contentType.startsWith("image/") || doc.contentType === "application/pdf" || doc.contentType === "text/plain";
  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `${download || !viewable ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
