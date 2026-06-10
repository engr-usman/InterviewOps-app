import type { OrgRole } from "@/server/services/rbac";
import { hasPermission } from "@/server/services/rbac";

export interface SettingsNavItem {
  href: string;
  label: string;
}

export function getSettingsNavItems(role: OrgRole): SettingsNavItem[] {
  const items: SettingsNavItem[] = [
    { href: "/settings", label: "General" },
    { href: "/settings/organization", label: "Organization" },
  ];

  if (role === "OWNER") {
    items.push({ href: "/settings/organizations", label: "Organization Management" });
  }

  if (hasPermission(role, "team:manage")) {
    items.push({ href: "/settings/team", label: "Team Management" });
  }

  if (hasPermission(role, "billing:manage") || hasPermission(role, "org:manage")) {
    items.push({ href: "/settings/billing", label: "Billing" });
  }

  return items;
}
