import * as React from "react";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrNull } from "@/server/services/org-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const orgCtx = await getOrgContextOrNull(session.user.id);
  if (!orgCtx) {
    if (process.env.NODE_ENV === "development") {
      const email = session.user?.email ?? null;
      const sessionUserId = (session.user as { id?: unknown } | undefined)?.id ?? null;
      const dbUser = email
        ? await prisma.user.findUnique({ where: { email }, select: { id: true, activeOrganizationId: true } })
        : null;
      const memberCount = dbUser
        ? await prisma.organizationMember.count({ where: { userId: dbUser.id } })
        : null;

      console.warn("dashboard redirect -> /onboarding (debug)", {
        sessionEmail: email,
        sessionUserId,
        dbUserId: dbUser?.id ?? null,
        dbActiveOrganizationId: dbUser?.activeOrganizationId ?? null,
        organizationMemberCount: memberCount,
      });
    }
    redirect("/onboarding");
  }

  const userEmail = session.user?.email ?? "";
  return (
    <DashboardShell userEmail={userEmail} userId={session.user.id} role={orgCtx.role}>
      {children}
    </DashboardShell>
  );
}
