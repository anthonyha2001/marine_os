import "server-only";
import { can, isAdmin, type CompanySlug, type CustomAccess, type Role } from "@/lib/permissions";

type Person = { role: Role; companySlug: CompanySlug | null; access?: CustomAccess };

/**
 * Who may delete what. The admin may delete anything; others only drafts (with the right).
 * Posted entries are cancelled or reversed instead, so they stay on record.
 * Returns the reason it's refused, or null when allowed. Deletes go to the recycle bin.
 */
export function deleteRefusal(user: Person, kind: "draft" | "posted" | "record") {
  if (isAdmin(user)) return null;
  if (kind === "posted") return "Only the admin can delete this. Cancel it instead, so it stays on record.";
  if (kind === "record") return "Only the admin can delete this.";
  return can(user, "deleteDrafts") ? null : "You don't have permission to delete drafts. Ask your manager.";
}
