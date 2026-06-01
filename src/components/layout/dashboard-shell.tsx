import * as React from "react";

import { DashboardHeader } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import type { OrgRole } from "@/server/services/rbac";

export function DashboardShell({
  children,
  userEmail,
  userId,
  role,
}: {
  children: React.ReactNode;
  userEmail: string;
  userId: string;
  role: OrgRole;
}) {
  return (
    <div className="flex h-dvh">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader userEmail={userEmail} userId={userId} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
