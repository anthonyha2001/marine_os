// Single source of truth for roles, companies and what each role can open.

export const COMPANIES = {
  "xpert-marine": {
    slug: "xpert-marine",
    name: "Xpert Marine",
    logo: "/logos/xpert-marine.png",
    mark: "/logos/xpert-marine-pdf.png", // trimmed: fills small spaces (sidebar, menus)
    tagline: "Engines · Parts · Maintenance",
  },
  "eliche-radice": {
    slug: "eliche-radice",
    name: "Eliche Radice",
    logo: "/logos/eliche-radice-navy.avif",
    mark: "/logos/eliche-radice-pdf.png",
    tagline: "Propellers",
  },
} as const;

export type CompanySlug = keyof typeof COMPANIES;
export const COMPANY_SLUGS = Object.keys(COMPANIES) as CompanySlug[];

export function isCompanySlug(value: string): value is CompanySlug {
  return value in COMPANIES;
}

export const ROLES = [
  "ADMIN",
  "MANAGER",
  "STOCK_WORKER",
  "REGULAR_WORKER",
  "MARKETING_MANAGER",
  "CASHIER",
  "ACCOUNTANT",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin (both companies)",
  MANAGER: "Manager",
  STOCK_WORKER: "Stock worker",
  REGULAR_WORKER: "Regular worker",
  MARKETING_MANAGER: "Marketing manager",
  CASHIER: "Cashier",
  ACCOUNTANT: "Accountant",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

// Modules (sections of the OS). Pages are placeholders until each is built.
export const MODULES = {
  dashboard: { label: "Dashboard", path: "dashboard" },
  owner: { label: "Owner dashboard", path: "owner" },
  audit: { label: "Audit log", path: "audit" },
  inventory: { label: "Inventory", path: "inventory" },
  services: { label: "Services", path: "services" },
  purchases: { label: "Purchases", path: "purchases" },
  suppliers: { label: "Suppliers", path: "suppliers" },
  offers: { label: "Offers", path: "offers" },
  customers: { label: "Customers", path: "customers" },
  invoices: { label: "Invoices", path: "invoices" },
  sales: { label: "Point of sale", path: "pos" },
  posAdmin: { label: "POS prices & settings", path: "pos/prices" },
  recycleBin: { label: "Recycle bin", path: "recycle-bin" },
  marketing: { label: "Marketing", path: "marketing" },
  accounting: { label: "Accounting", path: "accounting" },
  payroll: { label: "Payroll", path: "payroll" },
  workshop: { label: "Workshop", path: "workshop" },
  tasks: { label: "Tasks", path: "tasks" },
  team: { label: "Team & roles", path: "team" },
  settings: { label: "Company details", path: "settings" },
} as const;

export type ModuleKey = keyof typeof MODULES;
const ALL_MODULES = Object.keys(MODULES) as ModuleKey[];

export const ROLE_MODULES: Record<Role, ModuleKey[]> = {
  ADMIN: ALL_MODULES,
  MANAGER: ALL_MODULES,
  STOCK_WORKER: ["dashboard", "inventory", "services", "purchases", "suppliers", "workshop", "tasks"],
  REGULAR_WORKER: ["dashboard", "workshop", "tasks"],
  MARKETING_MANAGER: ["dashboard", "offers", "customers", "marketing", "tasks"],
  CASHIER: ["dashboard", "sales", "tasks"],
  ACCOUNTANT: ["dashboard", "purchases", "suppliers", "offers", "customers", "invoices", "accounting", "payroll", "workshop", "sales", "tasks"],
};

/**
 * What a person may do beyond opening pages. Deleting posted entries is the admin's alone;
 * deletes always go to the recycle bin, so they can be restored.
 */
export const CAPABILITIES = {
  cancelEntries: { label: "Cancel and reverse posted entries", hint: "Payments, receipts, vouchers and journal entries: the entry stays, stamped CANCELLED, with a reversing entry." },
  deleteDrafts: { label: "Delete drafts", hint: "Offers, purchase orders, payrolls, stock counts and job cards that are still drafts." },
} as const;
export type Capability = keyof typeof CAPABILITIES;
export const isCapability = (v: string): v is Capability => v in CAPABILITIES;

export const ROLE_CAPS: Record<Role, Capability[]> = {
  ADMIN: ["cancelEntries", "deleteDrafts"],
  MANAGER: ["cancelEntries", "deleteDrafts"],
  ACCOUNTANT: ["cancelEntries", "deleteDrafts"],
  STOCK_WORKER: ["deleteDrafts"],
  REGULAR_WORKER: [],
  MARKETING_MANAGER: ["deleteDrafts"],
  CASHIER: [],
};

/** Modules a manager can't hand out: they would let staff change permissions or see group figures. */
export const ADMIN_ONLY_MODULES: ModuleKey[] = ["team", "owner", "audit", "recycleBin"];

/** Custom access from the Team page (null = the role's defaults). */
export type CustomAccess = { modules: ModuleKey[]; caps: Capability[] } | null;

type Actor = { role: Role; companySlug: CompanySlug | null; access?: CustomAccess };

export const isAdmin = (user: { role: Role }) => user.role === "ADMIN";

/** Modules this person can hand out on the Team page. */
export function grantableModules(user: Actor): ModuleKey[] {
  const own = modulesFor(user);
  return user.role === "ADMIN" ? own : own.filter((m) => !ADMIN_ONLY_MODULES.includes(m));
}

/** Modules this person may open: their custom list, or their role's. */
export function modulesFor(user: Actor): ModuleKey[] {
  if (user.role === "ADMIN" || !user.access) return ROLE_MODULES[user.role];
  return user.access.modules;
}

export function can(user: Actor, cap: Capability) {
  if (user.role === "ADMIN") return true;
  return (user.access?.caps ?? ROLE_CAPS[user.role]).includes(cap);
}

/** Read the JSON stored on the user, keeping only known modules and capabilities. */
export function parseAccess(value: unknown): CustomAccess {
  if (!value || typeof value !== "object") return null;
  const v = value as { modules?: unknown; caps?: unknown };
  if (!Array.isArray(v.modules)) return null;
  return {
    modules: v.modules.filter((m): m is ModuleKey => typeof m === "string" && m in MODULES),
    caps: Array.isArray(v.caps) ? v.caps.filter((c): c is Capability => typeof c === "string" && isCapability(c)) : [],
  };
}

/** Which companies a user may enter. Admin: both. Everyone else: their own. */
export function allowedCompanies(user: Actor): CompanySlug[] {
  if (user.role === "ADMIN") return COMPANY_SLUGS;
  return user.companySlug ? [user.companySlug] : [];
}

export function canAccessCompany(user: Actor, slug: CompanySlug) {
  return allowedCompanies(user).includes(slug);
}

export function canAccessModule(user: Actor, slug: CompanySlug, mod: ModuleKey) {
  return canAccessCompany(user, slug) && modulesFor(user).includes(mod);
}

/**
 * Roles this user may hand out to staff inside a company.
 * ADMIN is group-wide and is never assigned from a company Team page.
 */
export function assignableRoles(user: Actor): Role[] {
  if (user.role === "ADMIN") return ROLES.filter((r) => r !== "ADMIN");
  if (user.role === "MANAGER") return ROLES.filter((r) => r !== "ADMIN" && r !== "MANAGER");
  return [];
}

/** Where to send a user right after login. */
export function homePath(user: Actor) {
  if (user.role === "ADMIN") return "/select-company";
  return user.companySlug ? `/c/${user.companySlug}/dashboard` : "/login";
}
