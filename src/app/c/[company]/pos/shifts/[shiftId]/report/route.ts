import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { listSales, listShifts, shiftReport } from "@/lib/data/pos";
import { getCompanyProfile } from "@/lib/data/sales";
import { formatMoney } from "@/lib/money";
import { formatLbp, formatRate, hasPos, shiftDifference } from "@/lib/pos";

// Z report on the 80 mm receipt printer. ?print=1 opens the print dialog.

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Beirut" });
const row = (l: string, r: string, cls = "") => `<div class="row ${cls}"><span>${l}</span><span>${r}</span></div>`;

export async function GET(request: Request, ctx: RouteContext<"/c/[company]/pos/shifts/[shiftId]/report">) {
  const { company, shiftId } = await ctx.params;
  const { user, slug } = await requireModule(company, "sales");
  if (!hasPos(slug)) notFound();
  const [shifts, sales, profile] = await Promise.all([listShifts(slug), listSales(slug), getCompanyProfile(slug)]);
  const shift = shifts.find((s) => s.id === shiftId);
  if (!shift || (user.role === "CASHIER" && shift.cashierId !== user.id)) return new Response("Shift not found", { status: 404 });
  const { summary, expected } = shiftReport(shift, sales);
  const diff = shiftDifference(shift);

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Z report ${esc(shift.number)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { margin: 0 auto; width: 74mm; font: 12px/1.35 "Courier New", ui-monospace, monospace; color: #000; background: #fff; }
  .center { text-align: center; } .name { font-weight: 700; font-size: 15px; }
  .title { text-align: center; font-weight: 700; margin: 8px 0 6px; }
  .row { display: flex; justify-content: space-between; gap: 8px; } .row span:last-child { white-space: nowrap; }
  .b { font-weight: 700; } .rule { border-top: 1px dashed #000; margin: 6px 0; }
  .sign { height: 36px; border-bottom: 1px solid #000; margin: 4px 8px; }
</style></head><body>
<div class="center"><div class="name">${esc(profile.legalName || profile.name)}</div></div>
<div class="title">Z REPORT · SHIFT ${esc(shift.number)}</div>
${row("Cashier", esc(shift.cashierName))}
${row("Opened", stamp.format(shift.openedAt))}
${row("Closed", shift.closedAt ? stamp.format(shift.closedAt) : "still open")}
<div class="rule"></div>
${row("Sales", String(summary.count))}
${row("Gross", formatMoney(summary.gross))}
${row("Refunds", `− ${formatMoney(summary.refunded)}`)}
${row("NET SALES", formatMoney(summary.net), "b")}
${row("of which VAT", formatMoney(summary.vat))}
<div class="rule"></div>
${row("Cash USD", formatMoney(summary.methods.usd))}
${row("Cash LBP", formatLbp(summary.methods.lbp))}
${row("Card", formatMoney(summary.methods.card))}
<div class="rule"></div>
${row("Float USD", formatMoney(shift.openingUsd))}
${row("Float LBP", formatLbp(shift.openingLbp))}
${row("Expected USD", formatMoney(expected.usd), "b")}
${row("Expected LBP", formatLbp(expected.lbp), "b")}
${shift.countedUsd !== null ? row("Counted USD", formatMoney(shift.countedUsd)) : ""}
${shift.countedLbp !== null ? row("Counted LBP", formatLbp(shift.countedLbp)) : ""}
${diff !== null ? row("DIFFERENCE", diff === 0 ? "balanced" : `${diff < 0 ? "short" : "over"} ${formatMoney(Math.abs(diff))}`, "b") : ""}
${shift.closeRate ? row("Rate", formatRate(shift.closeRate)) : ""}
<div class="rule"></div>
${summary.products.map((p) => row(`${p.quantity}× ${esc(p.name)}`, formatMoney(p.amountHT))).join("")}
<div class="rule"></div>
<div class="center">Cashier signature</div><div class="sign"></div>
${new URL(request.url).searchParams.has("print") ? `<script>window.addEventListener("load",()=>{window.focus();window.print();});</script>` : ""}
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
