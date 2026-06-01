import * as React from "react";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getOrgContextOrNull } from "@/server/services/org-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const orgCtx = await getOrgContextOrNull(session.user.id);
  if (!orgCtx) redirect("/onboarding");

  const userEmail = session.user?.email ?? "";
  return (
    <DashboardShell userEmail={userEmail} userId={session.user.id} role={orgCtx.role}>
      {children}
    </DashboardShell>
  );
}
