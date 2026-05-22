import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { setActiveOrganization } from "@/server/services/org-context";

type Db = {
  inviteToken: {
    findUnique: (args: unknown) => Promise<{
      id: string;
      organizationId: string;
      email: string;
      role: string;
      expiresAt: Date;
    } | null>;
    delete: (args: unknown) => Promise<unknown>;
  };
  organizationMember: {
    upsert: (args: unknown) => Promise<{ id: string }>;
  };
};

export default async function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  const { token } = await params;
  const db = prisma as unknown as Db;

  const invite = await db.inviteToken.findUnique({
    where: { token },
    select: { id: true, organizationId: true, email: true, role: true, expiresAt: true },
  });

  if (!invite || invite.expiresAt < new Date()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invite" description="Accept organization invitation" />
        <Card>
          <CardHeader>
            <CardTitle>Invalid invite</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">This invite link is invalid or expired.</CardContent>
        </Card>
      </div>
    );
  }

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId: session.user.id } },
    update: { role: invite.role },
    create: { organizationId: invite.organizationId, userId: session.user.id, role: invite.role, joinedAt: new Date() },
    select: { id: true },
  });

  await db.inviteToken.delete({ where: { id: invite.id } });
  await setActiveOrganization(session.user.id, invite.organizationId);

  redirect("/dashboard");
}
