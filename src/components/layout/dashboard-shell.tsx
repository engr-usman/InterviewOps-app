import * as React from "react";

import { DashboardHeader } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export function DashboardShell({
  children,
  userEmail,
  userId,
}: {
  children: React.ReactNode;
  userEmail: string;
  userId: string;
}) {
  return (
    <div className="flex h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader userEmail={userEmail} userId={userId} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
