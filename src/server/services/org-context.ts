import { prisma } from "@/lib/prisma";
import { getOrganizationPlanCode, type PlanCode } from "@/server/services/feature-flags";
import { orgRoleValues, type OrgRole } from "@/server/services/rbac";

type Db = {
  organizationMember: {
    findMany: (args: unknown) => Promise<
      Array<{
        organizationId: string;
        role: string;
        organization: { id: string; name: string; slug: string };
      }>
    >;
    findFirst: (args: unknown) => Promise<{ role: string; organization: { id: string; name: string; slug: string } } | null>;
  };
  user: {
    findUnique: (args: unknown) => Promise<{ activeOrganizationId: string | null } | null>;
    update: (args: unknown) => Promise<unknown>;
  };
};

const db = prisma as unknown as Db;

export type OrgContext = {
  organization: { id: string; name: string; slug: string };
  role: OrgRole;
  planCode: PlanCode;
};

export async function listUserOrganizations(userId: string): Promise<Array<{ id: string; name: string; slug: string; role: OrgRole }>> {
  const memberships = await db.organizationMember.findMany({
    where: { userId },
    select: {
      organizationId: true,
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: (orgRoleValues as readonly string[]).includes(m.role) ? (m.role as OrgRole) : "VIEWER",
  }));
}

export async function getActiveOrganizationId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { activeOrganizationId: true },
  });
  if (user?.activeOrganizationId) return user.activeOrganizationId;

  const orgs = await listUserOrganizations(userId);
  if (orgs.length >= 1) {
    await db.user.update({ where: { id: userId }, data: { activeOrganizationId: orgs[0].id } });
    return orgs[0].id;
  }

  return null;
}

export async function setActiveOrganization(userId: string, organizationId: string) {
  const member = await db.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });
  if (!member) throw new Error("Organization not found.");
  await db.user.update({ where: { id: userId }, data: { activeOrganizationId: organizationId } });
}

export async function getOrgContextOrNull(userId: string): Promise<OrgContext | null> {
  const organizationId = await getActiveOrganizationId(userId);
  if (!organizationId) return null;

  const membership = await db.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { role: true, organization: { select: { id: true, name: true, slug: true } } },
  });

  if (!membership) return null;
  const role = (orgRoleValues as readonly string[]).includes(membership.role) ? (membership.role as OrgRole) : "VIEWER";
  const planCode = await getOrganizationPlanCode(organizationId);

  return {
    organization: membership.organization,
    role,
    planCode,
  };
}

export async function getOrgContextOrThrow(userId: string): Promise<OrgContext> {
  const ctx = await getOrgContextOrNull(userId);
  if (!ctx) throw new Error("Organization setup required.");
  return ctx;
}
