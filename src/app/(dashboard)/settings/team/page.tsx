import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/services/access";
import { TeamManagement } from "@/features/orgs/team-management";
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
};

export default async function TeamSettingsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>> | null = null;
  let members: Array<{
    id: string;
    role: string;
    joinedAt: Date;
    user: { email: string; name: string | null };
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
  } catch (e) {
    error = e instanceof Error ? e.message : "You do not have access to manage the team.";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Team Management" description="Organization members, roles, and invitations (placeholder)." />
        <Button asChild variant="outline">
          <Link href="/settings">Back to Settings</Link>
        </Button>
      </div>

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
        />
      )}
    </div>
  );
}
