import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { OrganizationDeleteForm } from "@/app/(dashboard)/settings/organizations/[id]/delete/organization-delete-form";

export default async function OrganizationDeleteAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  if (ctx.role !== "OWNER") {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Access denied.</CardContent>
      </Card>
    );
  }

  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true },
  });
  if (!org) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Delete organization" description="This action is permanent." />
        <Button asChild variant="outline">
          <Link href={`/settings/organizations/${org.id}`}>Back</Link>
        </Button>
      </div>

      <OrganizationDeleteForm organizationId={org.id} organizationName={org.name} organizationSlug={org.slug} />
    </div>
  );
}

