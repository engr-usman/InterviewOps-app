import { prisma } from "@/lib/prisma";

export const planCodeValues = ["FREE", "PRO", "TEAM", "ENTERPRISE"] as const;
export type PlanCode = (typeof planCodeValues)[number];

export type FeatureFlag = "ai" | "advancedAnalytics" | "exports";

const planFeatures: Record<PlanCode, Record<FeatureFlag, boolean>> = {
  FREE: { ai: false, advancedAnalytics: false, exports: false },
  PRO: { ai: true, advancedAnalytics: false, exports: false },
  TEAM: { ai: true, advancedAnalytics: true, exports: true },
  ENTERPRISE: { ai: true, advancedAnalytics: true, exports: true },
};

export async function getOrganizationPlanCode(organizationId: string): Promise<PlanCode> {
  const rows = await prisma.$queryRaw<Array<{ code: string }>>`
    select p.code as code
    from "Subscription" s
    join "SubscriptionPlan" p on p.id = s."planId"
    where s."organizationId" = ${organizationId}
    order by s."createdAt" desc
    limit 1
  `;
  const code = rows[0]?.code;
  return typeof code === "string" && (planCodeValues as readonly string[]).includes(code) ? (code as PlanCode) : "FREE";
}

export async function hasFeature(organizationId: string, feature: FeatureFlag): Promise<boolean> {
  const plan = await getOrganizationPlanCode(organizationId);
  return planFeatures[plan][feature];
}
