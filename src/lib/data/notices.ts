import "server-only";
import { billStatus } from "@/lib/accounting";
import type { SessionUser } from "@/lib/auth";
import { listBills } from "@/lib/data/accounting";
import { listProductsWithStock } from "@/lib/data/inventory";
import { listPurchaseOrders } from "@/lib/data/purchase-orders";
import { invoicesWithBalance } from "@/lib/data/ledger";
import { listOffers } from "@/lib/data/sales";
import { formatMoney, round2 } from "@/lib/money";
import { canAccessModule, type CompanySlug } from "@/lib/permissions";

export type Notice = { label: string; detail: string; href: string; tone: "red" | "amber" | "blue" };

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What needs attention in this company, limited to what the user may open (top bar bell). */
export async function noticesFor(user: SessionUser, slug: CompanySlug): Promise<Notice[]> {
  const can = (m: Parameters<typeof canAccessModule>[2]) => canAccessModule(user, slug, m);
  const base = `/c/${slug}`;
  const today = new Date();
  const todayIso = iso(today);
  const weekIso = iso(new Date(today.getTime() + 7 * DAY));

  const [invoices, bills, products, orders, offers] = await Promise.all([
    can("invoices") ? invoicesWithBalance(slug) : [],
    can("accounting") ? listBills(slug) : [],
    can("inventory") ? listProductsWithStock(slug) : [],
    can("purchases") ? listPurchaseOrders(slug) : [],
    can("offers") ? listOffers(slug) : [],
  ]);
  const notices: Notice[] = [];

  const overdueInvoices = invoices.filter((i) => i.balance > 0 && iso(i.dueDate) < todayIso);
  if (overdueInvoices.length) {
    notices.push({
      label: `${plural(overdueInvoices.length, "overdue invoice")}`,
      detail: `${formatMoney(round2(overdueInvoices.reduce((s, i) => s + i.balance, 0)))} to collect from customers`,
      href: `${base}/invoices`,
      tone: "red",
    });
  }

  const openBills = bills.filter((b) => b.balance > 0);
  const overdueBills = openBills.filter((b) => billStatus(b.total, b.paid, b.dueDate, today) === "OVERDUE");
  const dueSoon = openBills.filter((b) => iso(b.dueDate) >= todayIso && iso(b.dueDate) <= weekIso);
  if (overdueBills.length) {
    notices.push({
      label: `${plural(overdueBills.length, "supplier bill")} overdue`,
      detail: `${formatMoney(round2(overdueBills.reduce((s, b) => s + b.balance, 0)))} past the due date`,
      href: `${base}/accounting`,
      tone: "red",
    });
  }
  if (dueSoon.length) {
    notices.push({
      label: `${plural(dueSoon.length, "supplier bill")} due this week`,
      detail: `${formatMoney(round2(dueSoon.reduce((s, b) => s + b.balance, 0)))} to pay in the next 7 days`,
      href: `${base}/accounting`,
      tone: "amber",
    });
  }

  const out = products.filter((p) => p.status === "out").length;
  const low = products.filter((p) => p.status === "low").length;
  if (out) notices.push({ label: `${plural(out, "product")} out of stock`, detail: "Reorder with a purchase order", href: `${base}/inventory?status=out`, tone: "red" });
  if (low) notices.push({ label: `${plural(low, "product")} low on stock`, detail: "At or below the minimum quantity", href: `${base}/inventory?status=low`, tone: "amber" });

  const late = orders.filter((o) => (o.status === "DRAFT" || o.status === "SENT") && o.expectedDate && iso(o.expectedDate) < todayIso);
  if (late.length) {
    notices.push({ label: `${plural(late.length, "purchase order")} late`, detail: "Expected delivery date has passed", href: `${base}/purchase-orders`, tone: "amber" });
  }

  const expiring = offers.filter((o) => o.status === "SENT" && iso(o.validUntil) >= todayIso && iso(o.validUntil) <= weekIso);
  if (expiring.length) {
    notices.push({ label: `${plural(expiring.length, "offer")} expire this week`, detail: "Sent offers awaiting the customer’s answer", href: `${base}/offers`, tone: "blue" });
  }

  return notices;
}
