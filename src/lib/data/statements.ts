import "server-only";
import { getLedger } from "@/lib/data/ledger";
import { listSuppliers } from "@/lib/data/inventory";
import { listCustomers } from "@/lib/data/sales";
import { partnerBalances, statement, type Partner, type Period } from "@/lib/ledger/reports";
import type { CompanySlug } from "@/lib/permissions";

export type PartnerType = "CUSTOMER" | "SUPPLIER";

/** Everything the statements page and its PDF need: partner list with balances, and the statement. */
export async function loadStatements(slug: CompanySlug, type: PartnerType, key: string | undefined, period: Period) {
  const [ledger, customers, suppliers] = await Promise.all([getLedger(slug), listCustomers(), listSuppliers()]);
  const supplierNames = new Map(suppliers.map((s) => [s.id, s.name]));
  const balances = partnerBalances(ledger, type, supplierNames);

  // Everyone who can be picked: saved records plus customers that only exist on invoices.
  const options =
    type === "CUSTOMER"
      ? [
          ...customers.map((c) => ({ key: c.id, name: c.name })),
          ...balances.filter((b) => !b.id).map((b) => ({ key: b.key, name: `${b.name} (not saved)` })),
        ]
      : suppliers.map((s) => ({ key: s.id, name: s.name }));

  let partner: Partner | null = null;
  if (key) {
    if (type === "SUPPLIER") {
      const name = supplierNames.get(key);
      if (name) partner = { type: "SUPPLIER", id: key, name };
    } else if (key.startsWith("name:")) {
      const b = balances.find((x) => x.key === key);
      if (b) partner = { type: "CUSTOMER", id: null, name: b.name };
    } else {
      const c = customers.find((x) => x.id === key);
      if (c) partner = { type: "CUSTOMER", id: c.id, name: c.name };
    }
  }
  return { balances, options, partner, result: partner ? statement(ledger, partner, period) : null };
}
