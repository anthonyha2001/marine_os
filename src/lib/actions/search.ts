"use server";

import { requireCompany } from "@/lib/auth";
import { getCatalogue, listSuppliers } from "@/lib/data/inventory";
import { listPurchaseOrders } from "@/lib/data/purchase-orders";
import { listCustomers, listInvoices, listOffers } from "@/lib/data/sales";
import { canAccessModule } from "@/lib/permissions";

export type SearchResult = { group: string; label: string; detail?: string; href: string };

const LIMIT = 6;

/**
 * Search across the company (Ctrl+K): products, services, customers, suppliers, offers,
 * invoices and purchase orders, limited to what the user may open. Reads the cached lists.
 */
export async function globalSearch(companySlug: string, query: string): Promise<SearchResult[]> {
  const { user, slug } = await requireCompany(companySlug);
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const can = (m: Parameters<typeof canAccessModule>[2]) => canAccessModule(user, slug, m);
  const base = `/c/${slug}`;
  const has = (...values: (string | null | undefined)[]) => values.some((v) => v?.toLowerCase().includes(q));

  const [catalogue, customers, suppliers, offers, invoices, orders] = await Promise.all([
    can("inventory") || can("services") ? getCatalogue() : [],
    can("customers") ? listCustomers() : [],
    can("suppliers") ? listSuppliers() : [],
    can("offers") ? listOffers(slug) : [],
    can("invoices") ? listInvoices(slug) : [],
    can("purchases") ? listPurchaseOrders(slug) : [],
  ]);

  const results: SearchResult[] = [];
  const push = (items: SearchResult[]) => results.push(...items.slice(0, LIMIT));

  push(
    catalogue
      .filter((p) => (p.type === "PRODUCT" ? can("inventory") : can("services")))
      .filter((p) => has(p.name, p.code) || p.barcodes.some((b) => b.toLowerCase().includes(q)))
      .map((p) => ({
        group: p.type === "PRODUCT" ? "Products" : "Services",
        label: p.name,
        detail: `#${p.code}`,
        href: `${base}/${p.type === "PRODUCT" ? "inventory" : "services"}/${p.id}`,
      })),
  );
  push(
    offers
      .filter((o) => has(o.number, o.customerName, o.subject))
      .map((o) => ({ group: "Offers", label: `${o.number} · ${o.customerName}`, detail: o.subject ?? undefined, href: `${base}/offers/${o.id}` })),
  );
  push(
    invoices
      .filter((i) => has(i.number, i.customerName, i.offer?.number))
      .map((i) => ({ group: "Invoices", label: `${i.number} · ${i.customerName}`, href: `${base}/invoices/${i.id}` })),
  );
  push(
    orders
      .filter((o) => has(o.number, o.supplierName, o.reference))
      .map((o) => ({ group: "Purchase orders", label: `${o.number} · ${o.supplierName}`, href: `${base}/purchase-orders/${o.id}` })),
  );
  push(
    customers
      .filter((c) => has(c.name, c.contactName, c.email, c.phone))
      .map((c) => ({ group: "Customers", label: c.name, detail: c.contactName ?? undefined, href: `${base}/invoices?q=${encodeURIComponent(c.name)}` })),
  );
  push(
    suppliers
      .filter((s) => has(s.name, s.accountNumber, s.email, s.phone))
      .map((s) => ({ group: "Suppliers", label: s.name, detail: s.accountNumber ? `Account ${s.accountNumber}` : undefined, href: `${base}/suppliers` })),
  );
  return results;
}
