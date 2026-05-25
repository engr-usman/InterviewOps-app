import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOrgContextOrThrow } from "@/server/services/org-context";

export default async function BillingSettingsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Billing" description="Plans, usage, and invoices (placeholder)" />
        <Button asChild variant="outline">
          <Link href="/settings">Back to Settings</Link>
        </Button>
      </div>

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

