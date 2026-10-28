// Sidebar layout and keyboard shortcuts. One list drives both, so they never disagree.
import { ROLE_MODULES, type CompanySlug, type ModuleKey, type Role } from "@/lib/permissions";
import { POS_COMPANIES } from "@/lib/pos";

/** Icon names, mapped to lucide icons in the (client) sidebar. */
export type NavIcon =
  | "dashboard"
  | "offers"
  | "invoices"
  | "customers"
  | "purchaseOrders"
  | "purchases"
  | "suppliers"
  | "stock"
  | "services"
  | "accounting"
  | "cash"
  | "receipts"
  | "vouchers"
  | "creditNotes"
  | "statements"
  | "reports"
  | "journal"
  | "chart"
  | "profit"
  | "cheques"
  | "reconcile"
  | "appointments"
  | "pos"
  | "vessels"
  | "jobCards"
  | "warranties"
  | "stockCounts"
  | "serials"
  | "transfers"
  | "staff"
  | "payroll"
  | "posSales"
  | "posShifts"
  | "team"
  | "company";

export type NavItem = {
  label: string;
  path: string; // relative to /c/[company]/
  module: ModuleKey; // permission needed to see it
  icon?: NavIcon;
  shortcut?: string; // "F2" or "Shift+F2" (KeyboardEvent.key, optional Shift)
  hidden?: boolean; // keyboard shortcut / search only, not shown in the sidebar
  companies?: CompanySlug[]; // only in these companies (default: all)
};

export type NavGroup = { title?: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { items: [{ label: "Dashboard", path: "dashboard", module: "dashboard", icon: "dashboard", shortcut: "F8" }] },
  {
    title: "Sales",
    items: [
      { label: "Offers", path: "offers", module: "offers", icon: "offers", shortcut: "Shift+F6" },
      { label: "Invoices", path: "invoices", module: "invoices", icon: "invoices", shortcut: "Shift+F7" },
      { label: "Customers", path: "customers", module: "customers", icon: "customers", shortcut: "Shift+F4" },
      { label: "Vessels", path: "vessels", module: "customers", icon: "vessels" },
      { label: "New offer", path: "offers/new", module: "offers", shortcut: "Shift+F2", hidden: true },
    ],
  },
  {
    title: "Workshop",
    items: [
      { label: "Job cards", path: "workshop", module: "workshop", icon: "jobCards" },
      { label: "Warranties", path: "warranties", module: "workshop", icon: "warranties" },
    ],
  },
  {
    title: "Retail",
    items: [
      { label: "Point of sale", path: "pos", module: "sales", icon: "pos", shortcut: "Shift+F9", companies: POS_COMPANIES },
      { label: "Counter sales", path: "pos/sales", module: "sales", icon: "posSales", companies: POS_COMPANIES },
      { label: "Shifts & reports", path: "pos/shifts", module: "sales", icon: "posShifts", companies: POS_COMPANIES },
    ],
  },
  {
    title: "Purchasing",
    items: [
      { label: "Purchase orders", path: "purchase-orders", module: "purchases", icon: "purchaseOrders", shortcut: "Shift+F3" },
      { label: "Purchases", path: "purchases", module: "purchases", icon: "purchases", shortcut: "F7" },
      { label: "Suppliers", path: "suppliers", module: "suppliers", icon: "suppliers", shortcut: "F4" },
      { label: "New purchase", path: "purchases/new", module: "purchases", shortcut: "F3", hidden: true },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Stock", path: "inventory", module: "inventory", icon: "stock", shortcut: "F6" },
      { label: "Services", path: "services", module: "services", icon: "services", shortcut: "F10" },
      { label: "Serial numbers", path: "inventory/serials", module: "inventory", icon: "serials" },
      { label: "Stock counts", path: "inventory/counts", module: "inventory", icon: "stockCounts" },
      { label: "Transfers", path: "inventory/transfers", module: "inventory", icon: "transfers" },
      // New product / New service open a pop-up on their list page.
      { label: "New product", path: "inventory?new=1", module: "inventory", shortcut: "F2", hidden: true },
      { label: "New service", path: "services?new=1", module: "services", shortcut: "F9", hidden: true },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Overview", path: "accounting", module: "accounting", icon: "accounting", shortcut: "Shift+F8" },
      { label: "Cash & bank", path: "finance/cash", module: "accounting", icon: "cash" },
      { label: "Receipts", path: "finance/receipts", module: "invoices", icon: "receipts" },
      { label: "Vouchers", path: "finance/vouchers", module: "accounting", icon: "vouchers" },
      { label: "Cheques", path: "finance/cheques", module: "accounting", icon: "cheques" },
      { label: "Credit notes", path: "finance/credit-notes", module: "invoices", icon: "creditNotes" },
      { label: "Statements", path: "finance/statements", module: "accounting", icon: "statements" },
      { label: "Reports", path: "finance/reports", module: "accounting", icon: "reports" },
      { label: "Profit", path: "finance/profit", module: "accounting", icon: "profit" },
      { label: "Journal", path: "finance/journal", module: "accounting", icon: "journal" },
      { label: "Chart of accounts", path: "finance/accounts", module: "accounting", icon: "chart" },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Staff", path: "staff", module: "payroll", icon: "staff" },
      { label: "Payroll", path: "payroll", module: "payroll", icon: "payroll" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Team & roles", path: "team", module: "team", icon: "team" },
      { label: "Company details", path: "settings", module: "settings", icon: "company" },
    ],
  },
  // Marketing and Tasks stay hidden until they are built.
];

/** Items a role may open (including shortcut-only ones), with no empty groups. */
export function navFor(role: Role, company: CompanySlug): NavGroup[] {
  const allowed = ROLE_MODULES[role];
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => allowed.includes(i.module) && (!i.companies || i.companies.includes(company))) })).filter(
    (g) => g.items.length > 0,
  );
}

/** What the sidebar shows: everything except shortcut-only items. */
export function visibleNav(groups: NavGroup[]): NavGroup[] {
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.hidden) })).filter((g) => g.items.length > 0);
}

/** Does a keydown match a shortcut like "F2" or "Shift+F2"? Shift must match exactly. */
export function matchesShortcut(shortcut: string, e: { key: string; shiftKey: boolean }) {
  const shift = shortcut.startsWith("Shift+");
  return e.key === (shift ? shortcut.slice(6) : shortcut) && e.shiftKey === shift;
}
