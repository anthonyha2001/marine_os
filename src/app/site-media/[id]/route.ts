import { prisma } from "@/lib/prisma";

/** Website pictures, stored in the database. A new upload gets a new id, so they never change. */
export async function GET(_request: Request, ctx: RouteContext<"/site-media/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const image = await prisma.websiteImage.findUnique({ where: { id }, select: { contentType: true, data: true } });
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: { "Content-Type": image.contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
