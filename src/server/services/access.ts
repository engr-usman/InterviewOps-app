import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasFeature, type FeatureFlag } from "@/server/services/feature-flags";
import { requirePermission, type Permission } from "@/server/services/rbac";

export async function requireOrgPermission(userId: string, permission: Permission) {
  const ctx = await getOrgContextOrThrow(userId);
  requirePermission(ctx.role, permission);
  return ctx;
}

export async function requireOrgFeature(userId: string, feature: FeatureFlag) {
  const ctx = await getOrgContextOrThrow(userId);
  const allowed = await hasFeature(ctx.organization.id, feature);
  if (!allowed) throw new Error("This feature is not available on your plan.");
  return ctx;
}

