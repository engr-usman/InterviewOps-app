export const orgRoleValues = ["OWNER", "ADMIN", "INTERVIEWER", "VIEWER"] as const;
export type OrgRole = (typeof orgRoleValues)[number];

export type Permission =
  | "org:manage"
  | "team:manage"
  | "candidate:manage"
  | "jobDescription:manage"
  | "interview:manage"
  | "interview:conduct"
  | "analytics:view"
  | "reports:view"
  | "reports:export"
  | "ai:use";

const rolePermissions: Record<OrgRole, Permission[]> = {
  OWNER: [
    "org:manage",
    "team:manage",
    "candidate:manage",
    "jobDescription:manage",
    "interview:manage",
    "interview:conduct",
    "analytics:view",
    "reports:view",
    "reports:export",
    "ai:use",
  ],
  ADMIN: [
    "team:manage",
    "candidate:manage",
    "jobDescription:manage",
    "interview:manage",
    "interview:conduct",
    "analytics:view",
    "reports:view",
    "reports:export",
    "ai:use",
  ],
  INTERVIEWER: ["interview:conduct", "analytics:view", "reports:view", "ai:use"],
  VIEWER: ["analytics:view", "reports:view"],
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function requirePermission(role: OrgRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error("Insufficient permissions.");
  }
}
