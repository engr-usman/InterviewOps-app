import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsNav } from "@/features/settings/settings-nav";
import { getSettingsNavItems } from "@/features/settings/settings-nav-items";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

export default async function BillingSettingsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManageBilling = hasPermission(ctx.role, "billing:manage") || hasPermission(ctx.role, "org:manage");
  const navItems = getSettingsNavItems(ctx.role);

  if (!canManageBilling) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing" description="Plans, usage, and invoices (placeholder)" />
        <SettingsNav items={navItems} />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">You do not have permission to manage billing.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Plans, usage, and invoices (placeholder)" />
      <SettingsNav items={navItems} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan <Badge variant="outline">{ctx.planCode}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="text-muted-foreground">
            Stripe billing is not implemented yet. This section will later show plan upgrades, payment method, invoices, and usage limits.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Monthly interviews</div>
              <div className="font-medium">—</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Exports</div>
              <div className="font-medium">—</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
