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
  | "interview:questions:manage"
  | "interview:conduct"
  | "analytics:view"
  | "reports:view"
  | "reports:generate"
  | "reports:export"
  | "questionBank:view"
  | "questionBank:create"
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
    "interview:questions:manage",
    "interview:conduct",
    "analytics:view",
    "reports:view",
    "reports:generate",
    "reports:export",
    "questionBank:view",
    "questionBank:create",
    "questionBank:manage",
    "ai:use",
  ],
  ADMIN: [
    "settings:manage",
    "team:manage",
    "candidate:view",
    "candidate:manage",
    "jobDescription:view",
    "jobDescription:manage",
    "interview:view",
    "interview:manage",
    "interview:questions:manage",
    "interview:conduct",
    "analytics:view",
    "reports:view",
    "reports:generate",
    "reports:export",
    "questionBank:view",
    "questionBank:create",
    "questionBank:manage",
    "ai:use",
  ],
  INTERVIEWER: [
    "candidate:view",
    "jobDescription:view",
    "interview:view",
    "interview:conduct",
    "interview:questions:manage",
    "questionBank:view",
    "analytics:view",
    "reports:view",
    "reports:generate",
    "ai:use",
  ],
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

export function canManageCandidates(role: OrgRole): boolean {
  return hasPermission(role, "candidate:manage");
}

export function canManageJobDescriptions(role: OrgRole): boolean {
  return hasPermission(role, "jobDescription:manage");
}

export function canManageInterviews(role: OrgRole): boolean {
  return hasPermission(role, "interview:manage");
}

export function canManageInterviewQuestions(role: OrgRole): boolean {
  return hasPermission(role, "interview:questions:manage");
}

export function canGenerateReports(role: OrgRole): boolean {
  return hasPermission(role, "reports:generate");
}

export function canExportReports(role: OrgRole): boolean {
  return hasPermission(role, "reports:export");
}

export function canManageSettings(role: OrgRole): boolean {
  return hasPermission(role, "settings:manage");
}

export function canUseAi(role: OrgRole): boolean {
  return hasPermission(role, "ai:use");
}

export function canCreateQuestionBankQuestions(role: OrgRole): boolean {
  return hasPermission(role, "questionBank:create");
}
