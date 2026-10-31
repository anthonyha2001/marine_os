"use server";

import { requireModule } from "@/lib/auth";
import { listBills } from "@/lib/data/accounting";
import { getLedger, invoicesWithBalance, listMoneyAccounts } from "@/lib/data/ledger";
import { listCustomers } from "@/lib/data/sales";

export type PayKind = "CUSTOMER" | "SUPPLIER" | "PAYMENT" | "RECEIPT" | "TRANSFER";

/**
 * What the payment pop-up needs to show its form, on whatever page it is opened.
 * Accounting only: data entry, stock and workshop staff never pay or receive money.
 */
export async function paymentFormData(companySlug: string, kind: PayKind, customerId?: string) {
  const { slug } = await requireModule(companySlug, "accounting");
  const accounts = await listMoneyAccounts(slug);

  if (kind === "SUPPLIER") {
    const bills = await listBills(slug);
    return {
      kind,
      accounts,
      bills: bills
        .filter((b) => b.balance > 0)
        .map((b) => ({ id: b.id, supplierId: b.supplierId, supplierName: b.supplierName, invoiceNumber: b.invoiceNumber, dueDate: b.dueDate.toISOString(), total: b.total, balance: b.balance })),
    };
  }

  if (kind === "CUSTOMER") {
    const [open, customers] = await Promise.all([invoicesWithBalance(slug), listCustomers()]);
    return {
      kind,
      accounts,
      // From a customer's page: only their invoices.
      invoices: open
        .filter((i) => i.balance > 0 && (!customerId || i.customerId === customerId))
        .map((i) => ({ id: i.id, number: i.number, customerName: i.customerName, totalTTC: i.totalTTC, balance: i.balance })),
      customers: customers.map((c) => ({ id: c.id, name: c.name })),
    };
  }

  const ledger = await getLedger(slug);
  return {
    kind,
    accounts,
    counterAccounts: ledger.accounts
      .filter((a) => a.active && !["CASH", "BANK", "RECEIVABLE", "PAYABLE"].includes(a.kind))
      .map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type })),
  };
}

export type PaymentFormData = Awaited<ReturnType<typeof paymentFormData>>;
