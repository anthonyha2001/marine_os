import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { getPosRules, getSale } from "@/lib/data/pos";
import { getCompanyProfile } from "@/lib/data/sales";
import { formatMoney, withVat } from "@/lib/money";
import { REFUND_METHODS, formatLbp, formatRate, hasPos } from "@/lib/pos";

// 80 mm thermal receipt as a plain HTML page. ?print=1 opens the print dialog on load
// (the till loads it in a hidden frame). ?refund=<id> prints a refund slip instead.

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Beirut" });
const row = (left: string, right: string, cls = "") => `<div class="row ${cls}"><span>${left}</span><span>${right}</span></div>`;

export async function GET(request: Request, ctx: RouteContext<"/c/[company]/pos/sales/[saleId]/receipt">) {
  const { company, saleId } = await ctx.params;
  const { slug } = await requireModule(company, "sales");
  if (!hasPos(slug)) notFound();
  const [sale, profile, rules] = await Promise.all([getSale(slug, saleId), getCompanyProfile(slug), getPosRules(slug)]);
  if (!sale) return new Response("Sale not found", { status: 404 });
  const url = new URL(request.url);
  const refund = url.searchParams.get("refund") ? sale.refunds.find((r) => r.id === url.searchParams.get("refund")) : undefined;

  const header = `
    <div class="center">
      <div class="name">${esc(profile.legalName || profile.name)}</div>
      ${(profile.address ?? "").split("\n").filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join("")}
      ${profile.phone ? `<div>Tel. ${esc(profile.phone)}</div>` : ""}
      ${profile.taxNumber ? `<div>VAT No. ${esc(profile.taxNumber)}</div>` : ""}
    </div>`;

  let body: string;
  if (refund) {
    body = `
      <div class="title">REFUND ${esc(refund.number)}</div>
      ${row("Date", esc(stamp.format(refund.createdAt)))}
      ${row("Original sale", esc(sale.number))}
      ${row("Cashier", esc(refund.cashierName))}
      <div class="rule"></div>
      <div>${esc(refund.reason)}</div>
      <div class="rule"></div>
      ${row("Excl. VAT", formatMoney(refund.totalHT))}
      ${row("VAT 11%", formatMoney(refund.vatAmount))}
      ${row("REFUNDED", formatMoney(refund.totalTTC), "big")}
      ${refund.method === "CASH_LBP" ? row("Paid back", formatLbp(refund.amountLbp)) : row("Paid back", REFUND_METHODS[refund.method])}
      <div class="rule"></div>
      <div class="center">Customer signature</div><div class="sign"></div>`;
  } else {
    const lines = sale.lines
      .map(
        (l) => `<div class="item">${esc(l.name)}</div>
        ${row(`&nbsp;&nbsp;${l.quantity} × ${formatMoney(withVat(l.unitPriceHT))}`, formatMoney(withVat(l.lineTotalHT)))}`,
      )
      .join("");
    body = `
      <div class="title">${sale.customerTaxNumber ? "TAX INVOICE" : "RECEIPT"} ${esc(sale.number)}</div>
      ${row("Date", esc(stamp.format(sale.createdAt)))}
      ${row("Cashier", esc(sale.cashierName))}
      ${sale.customerName !== "Walk-in customer" ? row("Customer", esc(sale.customerName)) : ""}
      ${sale.customerTaxNumber ? row("Customer VAT No.", esc(sale.customerTaxNumber)) : ""}
      <div class="rule"></div>
      ${lines}
      <div class="rule"></div>
      ${row("Subtotal excl. VAT", formatMoney(sale.subtotalHT))}
      ${sale.discountHT > 0 ? row(`Discount ${sale.discountPct}%`, `− ${formatMoney(sale.discountHT)}`) : ""}
      ${row("VAT 11%", formatMoney(sale.vatAmount))}
      ${row("TOTAL", formatMoney(sale.totalTTC), "big")}
      ${row("", formatLbp(Math.ceil((sale.totalTTC * sale.rate) / 1000) * 1000))}
      <div class="rule"></div>
      ${sale.paidUsd > 0 ? row("Cash USD", formatMoney(sale.paidUsd)) : ""}
      ${sale.paidLbp > 0 ? row("Cash LBP", formatLbp(sale.paidLbp)) : ""}
      ${sale.paidCard > 0 ? row("Card", formatMoney(sale.paidCard)) : ""}
      ${sale.changeUsd > 0 ? row("Change", formatMoney(sale.changeUsd)) : ""}
      ${sale.changeLbp > 0 ? row("Change", formatLbp(sale.changeLbp)) : ""}
      <div class="small">Rate ${formatRate(sale.rate)}</div>
      <div class="rule"></div>
      <div class="center">Thank you for your visit!</div>
      <div class="center small">${rules.receiptNote ? esc(rules.receiptNote).replace(/\n/g, "<br>") : "Goods can be returned with this receipt."}</div>`;
  }

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(refund?.number ?? sale.number)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; width: 74mm; font: 12px/1.35 "Courier New", ui-monospace, monospace; color: #000; background: #fff; }
  .center { text-align: center; }
  .name { font-weight: 700; font-size: 15px; margin-bottom: 2px; }
  .title { text-align: center; font-weight: 700; margin: 8px 0 6px; letter-spacing: .5px; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row span:last-child { white-space: nowrap; }
  .item { margin-top: 3px; }
  .big { font-weight: 700; font-size: 15px; margin-top: 3px; }
  .rule { border-top: 1px dashed #000; margin: 6px 0; }
  .small { font-size: 10px; }
  .sign { height: 40px; border-bottom: 1px solid #000; margin: 4px 8px 8px; }
  @media screen { body { padding: 12px 0; } }
</style></head>
<body>${header}${body}
${url.searchParams.has("print") ? `<script>window.addEventListener("load",()=>{window.print();if(window.parent!==window)window.parent.focus();});</script>` : ""}
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
