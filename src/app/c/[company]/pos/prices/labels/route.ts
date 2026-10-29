import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { barcodeSvg, isEan13 } from "@/lib/barcode-svg";
import { internalBarcodeFor } from "@/lib/barcode";
import { posPricing } from "@/lib/data/pos";
import { getCatalogue } from "@/lib/data/inventory";
import { formatMoney, withVat } from "@/lib/money";
import { hasPos, shelfPrice } from "@/lib/pos";

// Shelf labels as a printable page: name, shop price incl. VAT and a barcode the till scans.
// ?ids=a,b  ?format=roll (50 × 30 mm thermal labels) | a4 (3 × 8 on an A4 sheet)
// ?copies=1..50 | stock (one label per item in stock)  ?print=1 opens the print dialog.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** EAN-13 digits are printed 1 · 6 · 6, the usual way; other codes as they are. */
const humanCode = (code: string) => (isEan13(code) ? `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}` : code);

export async function GET(request: Request, ctx: RouteContext<"/c/[company]/pos/prices/labels">) {
  const { company } = await ctx.params;
  const { slug } = await requireModule(company, "posAdmin");
  if (!hasPos(slug)) notFound();
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const format = url.searchParams.get("format") === "a4" ? "a4" : "roll";
  const copiesParam = url.searchParams.get("copies") ?? "1";
  const fixedCopies = Math.min(Math.max(Math.floor(Number(copiesParam)) || 1, 1), 50);

  const [rows, catalogue] = await Promise.all([posPricing(slug), getCatalogue()]);
  const barcodes = new Map(catalogue.map((p) => [p.id, p.barcodes]));
  const labels: string[] = [];
  for (const id of ids) {
    const r = rows.find((x) => x.id === id);
    if (!r) continue;
    // The product's first barcode; products without one get the same in-store EAN-13 the app assigns.
    const code = barcodes.get(r.id)?.[0] ?? internalBarcodeFor(r.code);
    let svg: string;
    try {
      svg = barcodeSvg(code);
    } catch {
      svg = barcodeSvg(internalBarcodeFor(r.code));
    }
    const price = r.posPriceHT !== null ? shelfPrice(r.posPriceHT) : withVat(r.priceHT);
    const html = `<div class="label">
      <div class="name">${esc(r.name)}</div>
      <div class="price">${formatMoney(price)}</div>
      <div class="bars">${svg}</div>
      <div class="code">${esc(humanCode(code))}</div>
    </div>`;
    const copies = copiesParam === "stock" ? Math.min(Math.max(r.stock, 0), 500) : fixedCopies;
    for (let i = 0; i < copies; i++) labels.push(html);
  }

  const page =
    format === "roll"
      ? `@page { size: 50mm 30mm; margin: 0; }
         .sheet { display: block; }
         .label { width: 50mm; height: 30mm; padding: 1.5mm 2.5mm; page-break-after: always; break-after: page; }
         .label:last-child { page-break-after: auto; break-after: auto; }`
      : `@page { size: A4; margin: 10mm 5mm; }
         .sheet { display: grid; grid-template-columns: repeat(3, 66mm); grid-auto-rows: 34.6mm; justify-content: center; }
         .label { padding: 2mm 3mm; outline: 0.2mm dashed #ccc; outline-offset: -0.1mm; }`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shelf labels</title>
<style>
  ${page}
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
  .label { display: flex; flex-direction: column; overflow: hidden; break-inside: avoid; }
  .name { font-size: 8.5pt; line-height: 1.15; font-weight: 600; max-height: 2.3em; overflow: hidden; }
  .price { font-size: 13pt; font-weight: 700; margin-top: 0.5mm; }
  .bars { flex: 1; min-height: 7mm; margin-top: 0.5mm; }
  .bars svg { display: block; width: 100%; height: 100%; }
  .code { font-size: 7pt; text-align: center; letter-spacing: 0.5px; }
  .empty { font: 14px Arial, sans-serif; padding: 24px; }
  @media screen { body { background: #f1f3f6; padding: 16px; } .label { background: #fff; margin: 0 auto 8px; } .sheet { gap: 0; } }
</style></head>
<body>${labels.length ? `<div class="sheet">${labels.join("")}</div>` : `<p class="empty">No labels to print. Choose products${copiesParam === "stock" ? " that are in stock" : ""}.</p>`}
${url.searchParams.has("print") && labels.length ? `<script>window.addEventListener("load",()=>window.print());</script>` : ""}
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
