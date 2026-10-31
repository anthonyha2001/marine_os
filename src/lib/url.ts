/** Adds or replaces query values on a path ("/x?a=1" + {b: "2"} → "/x?a=1&b=2"); null removes one. */
export function withParams(href: string, values: Record<string, string | null | undefined>) {
  const [path, query = ""] = href.split("?");
  const p = new URLSearchParams(query);
  for (const [k, v] of Object.entries(values)) {
    if (v === null || v === undefined) p.delete(k);
    else p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}

export type PayLinkKind = "CUSTOMER" | "SUPPLIER" | "PAYMENT" | "RECEIPT" | "TRANSFER";

/**
 * Opens the payment pop-up on the page at `href` (it is mounted in the app shell, so any page works).
 * Accounting only: show these links to people who may use the accounting module.
 */
export function payHref(href: string, kind: PayLinkKind, ref: { invoice?: string; bill?: string; customer?: string } = {}) {
  return withParams(href, { pay: kind, payInvoice: ref.invoice, payBill: ref.bill, payCustomer: ref.customer });
}
