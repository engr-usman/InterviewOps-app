import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/services/access";
import { TeamManagement } from "@/features/orgs/team-management";
import { SettingsNav } from "@/features/settings/settings-nav";
import { getSettingsNavItems } from "@/features/settings/settings-nav-items";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { orgRoleValues, type OrgRole } from "@/server/services/rbac";

type Db = {
  organizationMember: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        role: string;
        joinedAt: Date;
        user: { email: string; name: string | null };
      }>
    >;
  };
  inviteToken: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        email: string;
        role: string;
        expiresAt: Date;
        createdAt: Date;
        metadataJson: { usedAt?: string; usedById?: string } | null;
      }>
    >;
  };
};

export default async function TeamSettingsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const baseCtx = await getOrgContextOrThrow(session.user.id);
  const navItems = getSettingsNavItems(baseCtx.role);

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>> | null = null;
  let members: Array<{
    id: string;
    role: string;
    joinedAt: Date;
    user: { email: string; name: string | null };
  }> = [];
  let pendingInvites: Array<{
    id: string;
    email: string;
    role: string;
    expiresAt: Date;
    createdAt: Date;
  }> = [];
  let error: string | null = null;

  try {
    ctx = await requireOrgPermission(session.user.id, "team:manage");
    const db = prisma as unknown as Db;
    members = await db.organizationMember.findMany({
      where: { organizationId: ctx.organization.id },
      select: { id: true, role: true, joinedAt: true, user: { select: { email: true, name: true } } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      take: 200,
    });
    const invites = await db.inviteToken.findMany({
      where: { organizationId: ctx.organization.id },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, metadataJson: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    pendingInvites = invites
      .filter((i) => !i.metadataJson?.usedAt)
      .map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt, createdAt: i.createdAt }));
  } catch (e) {
    error = e instanceof Error ? e.message : "You do not have access to manage the team.";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Team Management" description="Manage organization members, roles, and invitations." />
      <SettingsNav items={navItems} />

      {error || !ctx ? (
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : (
        <TeamManagement
          organizationName={ctx.organization.name}
          organizationSlug={ctx.organization.slug}
          planCode={ctx.planCode}
          members={members.map((m) => ({
            id: m.id,
            role: (orgRoleValues as readonly string[]).includes(m.role) ? (m.role as OrgRole) : "VIEWER",
            joinedAt: m.joinedAt.toISOString(),
            userEmail: m.user.email,
            userName: m.user.name,
          }))}
          pendingInvites={pendingInvites.map((i) => ({
            id: i.id,
            email: i.email,
            role: (orgRoleValues as readonly string[]).includes(i.role) ? (i.role as OrgRole) : "VIEWER",
            expiresAt: i.expiresAt.toISOString(),
            createdAt: i.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
