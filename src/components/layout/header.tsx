"use client";

import { SignOutButton } from "@/components/auth/sign-out-button";

export function DashboardHeader({ userEmail }: { userEmail: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="text-sm text-muted-foreground">InterviewOps</div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground">{userEmail}</div>
        <SignOutButton />
      </div>
    </header>
  );
}
