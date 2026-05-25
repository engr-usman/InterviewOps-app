import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/prisma";
import { OrganizationSettingsForm } from "@/features/orgs/organization-settings-form";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

type SubscriptionSummary = { code: string; status: string; name: string | null } | null;

async function getSubscriptionSummary(organizationId: string): Promise<SubscriptionSummary> {
  const rows = await prisma.$queryRaw<Array<{ code: string; status: string; name: string | null }>>`
    select p.code as code, s.status as status, p.name as name
    from "Subscription" s
    join "SubscriptionPlan" p on p.id = s."planId"
    where s."organizationId" = ${organizationId}
    order by s."createdAt" desc
    limit 1
  `;
  return rows[0] ?? null;
}

export default async function OrganizationSettingsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canEdit = ctx.role === "OWNER" || ctx.role === "ADMIN";
  const canManageTeam = hasPermission(ctx.role, "team:manage");

  const [org, subscription] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: ctx.organization.id },
      select: { id: true, name: true, slug: true, website: true, industry: true, companySize: true, logoUrl: true, createdAt: true },
    }),
    getSubscriptionSummary(ctx.organization.id),
  ]);

  if (!org) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Organization" description="Profile and subscription overview" />
        <div className="flex flex-wrap items-center gap-2">
          {canManageTeam ? (
            <Button asChild variant="outline">
              <Link href="/settings/team">Team Management</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/settings">Back to Settings</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 truncate">{org.name}</span>
            <Badge variant="muted">{ctx.role}</Badge>
            <Badge variant="outline">{subscription?.code ?? ctx.planCode}</Badge>
            {subscription?.status ? <Badge variant="secondary">{subscription.status}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Slug</div>
              <div className="font-medium">{org.slug}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Website</div>
              <div className="font-medium">{org.website ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Industry</div>
              <div className="font-medium">{org.industry ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Company size</div>
              <div className="font-medium">{org.companySize ?? "—"}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-muted-foreground">Logo URL</div>
              <div className="truncate font-medium">{org.logoUrl ?? "—"}</div>
            </div>
          </div>

          {canEdit ? (
            <>
              <Separator />
              <OrganizationSettingsForm
                initialValues={{
                  name: org.name,
                  website: org.website,
                  industry: org.industry,
                  companySize: org.companySize,
                  logoUrl: org.logoUrl,
                }}
              />
            </>
          ) : (
            <>
              <Separator />
              <div className="text-sm text-muted-foreground">You have read-only access to organization settings.</div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription (placeholder)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Plan</div>
            <div className="font-medium">{subscription?.name ?? subscription?.code ?? ctx.planCode}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Status</div>
            <div className="font-medium">{subscription?.status ?? "—"}</div>
          </div>
          <div className="sm:col-span-2 text-muted-foreground">
            Billing is not implemented yet. This page is ready for Stripe integration later.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

