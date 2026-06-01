export const orgRoleValues = ["OWNER", "ADMIN", "INTERVIEWER", "VIEWER"] as const;
export type OrgRole = (typeof orgRoleValues)[number];

export type Permission =
  | "org:manage"
  | "settings:manage"
  | "billing:manage"
  | "team:manage"
  | "candidate:view"
  | "candidate:manage"
  | "jobDescription:view"
  | "jobDescription:manage"
  | "interview:view"
  | "interview:manage"
  | "interview:conduct"
  | "analytics:view"
  | "reports:view"
  | "reports:generate"
  | "reports:export"
  | "questionBank:view"
  | "questionBank:manage"
  | "ai:use";

const rolePermissions: Record<OrgRole, Permission[]> = {
  OWNER: [
    "org:manage",
    "settings:manage",
    "billing:manage",
    "team:manage",
    "candidate:view",
    "candidate:manage",
    "jobDescription:view",
    "jobDescription:manage",
    "interview:view",
    "interview:manage",
    "interview:conduct",
    "analytics:view",
    "reports:view",
    "reports:generate",
    "reports:export",
    "questionBank:view",
    "questionBank:manage",
    "ai:use",
  ],
  ADMIN: [
    "settings:manage",
    "billing:manage",
    "team:manage",
    "candidate:view",
    "candidate:manage",
    "jobDescription:view",
    "jobDescription:manage",
    "interview:view",
    "interview:manage",
    "interview:conduct",
    "analytics:view",
    "reports:view",
    "reports:generate",
    "reports:export",
    "questionBank:view",
    "questionBank:manage",
    "ai:use",
  ],
  INTERVIEWER: ["candidate:view", "jobDescription:view", "interview:view", "interview:conduct", "questionBank:view", "analytics:view", "reports:view", "ai:use"],
  VIEWER: ["candidate:view", "jobDescription:view", "interview:view", "questionBank:view", "analytics:view", "reports:view"],
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function requirePermission(role: OrgRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error("Insufficient permissions.");
  }
}
