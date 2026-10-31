import { portalCustomer } from "@/lib/data/portal";

/**
 * Each customer's portal installs as its own app: it opens straight on their account
 * (start_url and scope are their private link), with its own name and icon.
 */
export async function GET(_request: Request, ctx: RouteContext<"/p/[token]/manifest.webmanifest">) {
  const { token } = await ctx.params;
  const customer = await portalCustomer(token);
  if (!customer) return new Response("Not found", { status: 404 });
  const home = `/p/${token}`;
  return Response.json(
    {
      id: home,
      name: "My boat · Eliche Radice & Xpert Marine",
      short_name: "My boat",
      description: `${customer.name}: boats, work in progress, invoices, appointments and messages.`,
      start_url: home,
      scope: `${home}/`,
      display: "standalone",
      orientation: "portrait",
      background_color: "#0a1929",
      theme_color: "#0a1929",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "private, no-store" } },
  );
}
