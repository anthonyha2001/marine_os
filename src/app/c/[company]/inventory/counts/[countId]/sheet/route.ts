import { requireModule } from "@/lib/auth";
import { listStockCounts } from "@/lib/data/stock-ops";
import { getCompanyProfile } from "@/lib/data/sales";

// Printable count sheet (A4): product list with an empty box to write the counted quantity.
// The system quantity is left off on purpose so the count isn't influenced by it.

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

export async function GET(_request: Request, ctx: RouteContext<"/c/[company]/inventory/counts/[countId]/sheet">) {
  const { company, countId } = await ctx.params;
  const { slug } = await requireModule(company, "inventory");
  const [counts, profile] = await Promise.all([listStockCounts(slug), getCompanyProfile(slug)]);
  const count = counts.find((c) => c.id === countId);
  if (!count) return new Response("Count not found", { status: 404 });
  const rows = count.lines
    .map((l, i) => `<tr><td>${i + 1}</td><td class="mono">${esc(l.code)}</td><td>${esc(l.name)}</td><td class="box"></td></tr>`)
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(count.number)} count sheet</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font: 12px/1.4 Arial, sans-serif; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; } p { margin: 0 0 12px; color: #555; }
  table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f1f3f6; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  .mono { font-family: monospace; } .box { width: 90px; border: 1px solid #999; }
  .sign { margin-top: 28px; display: flex; gap: 40px; } .sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; color: #555; }
</style></head><body>
<h1>${esc(profile.legalName || profile.name)} · Stock count ${esc(count.number)}</h1>
<p>${day.format(count.countDate)}${count.notes ? ` · ${esc(count.notes)}` : ""} · ${count.lines.length} products</p>
<table><thead><tr><th>#</th><th>Code</th><th>Product</th><th>Counted</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sign"><div>Counted by</div><div>Checked by</div></div>
<script>window.addEventListener("load",()=>window.print());</script>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
