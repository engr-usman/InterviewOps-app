import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { ActiveOrgSwitcher } from "@/features/orgs/active-org-switcher";
import { getOrgContextOrNull, listUserOrganizations } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

export async function DashboardHeader({ userEmail, userId }: { userEmail: string; userId: string }) {
  const ctx = await getOrgContextOrNull(userId);
  const orgs = await listUserOrganizations(userId);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        {ctx ? (
          <ActiveOrgSwitcher
            activeOrganization={{ ...ctx.organization, role: ctx.role }}
            organizations={orgs}
            planCode={ctx.planCode}
            canManageTeam={hasPermission(ctx.role, "team:manage")}
          />
        ) : (
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">No organization selected</div>
            <Button asChild size="sm" variant="outline">
              <Link href="/onboarding">Complete onboarding</Link>
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-sm text-muted-foreground sm:block">{userEmail}</div>
        <SignOutButton />
      </div>
    </header>
  );
}
