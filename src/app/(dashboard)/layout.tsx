import * as React from "react";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const userEmail = session.user?.email ?? "";
  return <DashboardShell userEmail={userEmail}>{children}</DashboardShell>;
}
