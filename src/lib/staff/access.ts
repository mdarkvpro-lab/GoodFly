/** Who may do what in the staff area (pure, unit-tested in tests/staff). The database enforces the same rules. */

export const PERMISSIONS = ["programs.manage", "clients.view", "reports.view", "bookings.manage"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type StaffUser = {
  id: string;
  email: string;
  fullName: string;
  role: "direction" | "agent";
  permissions: Permission[];
  mustChangePassword: boolean;
};

/** Direction accounts have every permission; employees only those Direction granted. */
export const can = (user: Pick<StaffUser, "role" | "permissions">, p: Permission) => user.role === "direction" || user.permissions.includes(p);

/** First page an account lands on (always one it is allowed to open). */
export function staffHome(user: Pick<StaffUser, "role" | "permissions">): string {
  if (can(user, "reports.view")) return "";
  if (can(user, "programs.manage")) return "programmes";
  if (can(user, "clients.view")) return "comptes";
  return "mon-compte";
}

export type NavItem = { page: string; key: "overview" | "programs" | "accounts" | "employees" | "journal" | "me" };

export function staffNav(user: Pick<StaffUser, "role" | "permissions">): NavItem[] {
  const items: NavItem[] = [];
  if (can(user, "reports.view")) items.push({ page: "", key: "overview" });
  if (can(user, "programs.manage")) items.push({ page: "programmes", key: "programs" });
  if (can(user, "clients.view")) items.push({ page: "comptes", key: "accounts" });
  if (user.role === "direction") items.push({ page: "employes", key: "employees" }, { page: "journal", key: "journal" });
  items.push({ page: "mon-compte", key: "me" });
  return items;
}
