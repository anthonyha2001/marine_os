// Sidebar sections, page tabs, "+ New" menu and keyboard shortcuts. One list drives them all, so they never disagree.
import { modulesFor, type CompanySlug, type CustomAccess, type ModuleKey, type Role } from "@/lib/permissions";
import { POS_COMPANIES } from "@/lib/pos";

/** Icon names, mapped to lucide icons in the (client) sidebar. */
export type NavIcon =
  | "dashboard"
  | "owner"
  | "audit"
  | "recycleBin"
  | "marketing"
  | "website"
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
  | "posPrices"
  | "posSettings"
  | "team"
  | "company"
  | "money"
  | "settings";

export type NavItem = {
  label: string;
  tab?: string; // shorter name on the section's tab bar
  path: string; // relative to /c/[company]/
  module: ModuleKey; // permission needed to see it
  icon?: NavIcon;
  shortcut?: string; // "F2" or "Shift+F2" (KeyboardEvent.key, optional Shift)
  hidden?: boolean; // shortcut / search / "+ New" only, not a tab
  create?: boolean; // listed in the top bar's "+ New" menu
  companies?: CompanySlug[]; // only in these companies (default: all)
};

/** One sidebar entry. Its pages show as tabs at the top of the page. */
export type NavGroup = { title: string; icon: NavIcon; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    title: "Dashboard",
    icon: "dashboard",
    items: [
      { label: "Dashboard", tab: "Today", path: "dashboard", module: "dashboard", icon: "dashboard" },
      { label: "Owner dashboard", tab: "Owner view", path: "owner", module: "owner", icon: "owner" },
    ],
  },
  {
    title: "Sales",
    icon: "offers",
    items: [
      { label: "Offers", path: "offers", module: "offers", icon: "offers" },
      { label: "Invoices", path: "invoices", module: "invoices", icon: "invoices" },
      { label: "Credit notes", path: "finance/credit-notes", module: "invoices", icon: "creditNotes" },
      { label: "New offer", path: "offers/new", module: "offers", hidden: true, create: true },
      { label: "New invoice", path: "invoices?new=1", module: "invoices", hidden: true, create: true },
    ],
  },
  {
    title: "Customers",
    icon: "customers",
    items: [
      { label: "Customers", path: "customers", module: "customers", icon: "customers" },
      { label: "Vessels", path: "vessels", module: "customers", icon: "vessels" },
      { label: "Statements", path: "finance/statements", module: "accounting", icon: "statements" },
      { label: "New customer", path: "customers?new=1", module: "customers", hidden: true, create: true },
      { label: "New vessel", path: "vessels?new=1", module: "customers", hidden: true, create: true },
    ],
  },
  {
    title: "Workshop",
    icon: "jobCards",
    items: [
      { label: "Appointments", path: "appointments", module: "workshop", icon: "appointments" },
      { label: "Job cards", path: "workshop", module: "workshop", icon: "jobCards" },
      { label: "Warranties", path: "warranties", module: "workshop", icon: "warranties" },
      { label: "New appointment", path: "appointments?new=1", module: "workshop", hidden: true, create: true },
      { label: "New job card", path: "workshop/new", module: "workshop", hidden: true, create: true },
    ],
  },
  {
    title: "Point of sale",
    icon: "pos",
    items: [
      { label: "Point of sale", tab: "Till", path: "pos", module: "sales", icon: "pos", companies: POS_COMPANIES },
      { label: "Counter sales", tab: "Sales", path: "pos/sales", module: "sales", icon: "posSales", companies: POS_COMPANIES },
      { label: "Shifts & reports", tab: "Shifts", path: "pos/shifts", module: "sales", icon: "posShifts", companies: POS_COMPANIES },
      { label: "Prices & margins", tab: "Prices", path: "pos/prices", module: "posAdmin", icon: "posPrices", companies: POS_COMPANIES },
      { label: "POS settings", tab: "Settings", path: "pos/settings", module: "posAdmin", icon: "posSettings", companies: POS_COMPANIES },
    ],
  },
  {
    title: "Purchasing",
    icon: "purchases",
    items: [
      { label: "Purchase orders", path: "purchase-orders", module: "purchases", icon: "purchaseOrders" },
      { label: "Purchases", path: "purchases", module: "purchases", icon: "purchases" },
      { label: "Suppliers", path: "suppliers", module: "suppliers", icon: "suppliers" },
      { label: "New purchase order", path: "purchase-orders/new", module: "purchases", hidden: true, create: true },
      { label: "New purchase", path: "purchases/new", module: "purchases", hidden: true, create: true },
    ],
  },
  {
    title: "Stock",
    icon: "stock",
    items: [
      { label: "Stock", tab: "Products", path: "inventory", module: "inventory", icon: "stock" },
      { label: "Services", path: "services", module: "services", icon: "services" },
      { label: "Serial numbers", path: "inventory/serials", module: "inventory", icon: "serials" },
      { label: "Stock counts", path: "inventory/counts", module: "inventory", icon: "stockCounts" },
      { label: "Transfers", path: "inventory/transfers", module: "inventory", icon: "transfers" },
      // New product / New service open a pop-up on their list page.
      { label: "New product", path: "inventory?new=1", module: "inventory", hidden: true, create: true },
      { label: "New service", path: "services?new=1", module: "services", hidden: true, create: true },
    ],
  },
  {
    title: "Money",
    icon: "money",
    items: [
      { label: "Receipts", path: "finance/receipts", module: "invoices", icon: "receipts" },
      { label: "Vouchers", path: "finance/vouchers", module: "accounting", icon: "vouchers" },
      { label: "Cheques", path: "finance/cheques", module: "accounting", icon: "cheques" },
      { label: "Cash & bank", path: "finance/cash", module: "accounting", icon: "cash" },
      { label: "Customer payment", path: "finance/vouchers?new=CUSTOMER", module: "accounting", hidden: true, create: true },
      { label: "Pay a supplier", path: "finance/vouchers?new=SUPPLIER", module: "accounting", hidden: true, create: true },
      { label: "Expense payment", path: "finance/vouchers?new=PAYMENT", module: "accounting", hidden: true, create: true },
    ],
  },
  {
    title: "Accounting",
    icon: "accounting",
    items: [
      { label: "Accounting overview", tab: "Overview", path: "accounting", module: "accounting", icon: "accounting" },
      { label: "Reports", path: "finance/reports", module: "accounting", icon: "reports" },
      { label: "Profit", path: "finance/profit", module: "accounting", icon: "profit" },
      { label: "Journal", path: "finance/journal", module: "accounting", icon: "journal" },
      { label: "Chart of accounts", path: "finance/accounts", module: "accounting", icon: "chart" },
      { label: "Bank reconciliation", path: "finance/reconcile", module: "accounting", icon: "reconcile" },
    ],
  },
  {
    title: "Marketing",
    icon: "marketing",
    items: [
      { label: "Marketing", tab: "Overview", path: "marketing", module: "marketing", icon: "marketing" },
      { label: "Website", path: "marketing/website", module: "marketing", icon: "website" },
    ],
  },
  {
    title: "People",
    icon: "staff",
    items: [
      { label: "Staff", path: "staff", module: "payroll", icon: "staff" },
      { label: "Payroll", path: "payroll", module: "payroll", icon: "payroll" },
      { label: "New employee", path: "staff?new=1", module: "payroll", hidden: true, create: true },
    ],
  },
  {
    title: "Settings",
    icon: "settings",
    items: [
      { label: "Company details", path: "settings", module: "settings", icon: "company" },
      { label: "Team & roles", path: "team", module: "team", icon: "team" },
      { label: "Audit log", path: "audit", module: "audit", icon: "audit" },
      { label: "Recycle bin", path: "recycle-bin", module: "recycleBin", icon: "recycleBin" },
    ],
  },
  // Tasks stay hidden until they are built.
];

/** Items this person may open (including shortcut-only ones), with no empty groups. */
export function navFor(user: { role: Role; companySlug: CompanySlug | null; access?: CustomAccess }, company: CompanySlug): NavGroup[] {
  const allowed = modulesFor(user);
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => allowed.includes(i.module) && (!i.companies || i.companies.includes(company))) })).filter(
    (g) => g.items.length > 0,
  );
}

/** What the sidebar shows: sections with at least one page (tab) this person may open. */
export function visibleNav(groups: NavGroup[]): NavGroup[] {
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.hidden) })).filter((g) => g.items.length > 0);
}

/** The section and page a path belongs to: the longest matching page path wins ("pos/sales" over "pos"). */
export function activePage(groups: NavGroup[], base: string, pathname: string) {
  let best: { group: NavGroup; href: string } | null = null;
  for (const group of groups)
    for (const item of group.items) {
      const href = `${base}/${item.path}`;
      if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > (best?.href.length ?? 0)) best = { group, href };
    }
  return best;
}

/** Does a keydown match a shortcut like "F2" or "Shift+F2"? Shift must match exactly. */
export function matchesShortcut(shortcut: string, e: { key: string; shiftKey: boolean }) {
  const shift = shortcut.startsWith("Shift+");
  return e.key === (shift ? shortcut.slice(6) : shortcut) && e.shiftKey === shift;
}
