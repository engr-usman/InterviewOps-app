import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { OrganizationEditForm } from "@/app/(dashboard)/settings/organizations/[id]/edit/organization-edit-form";

export default async function OrganizationEditAdminPage({ params }: { params: Promise<{ id: string }> }) {
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
    select: {
      id: true,
      name: true,
      slug: true,
      website: true,
      industry: true,
      companySize: true,
      logoUrl: true,
    },
  });
  if (!org) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Edit organization" description="Update organization fields." />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/settings/organizations/${org.id}`}>Back</Link>
          </Button>
        </div>
      </div>

      <OrganizationEditForm
        organizationId={org.id}
        initialValues={{
          name: org.name,
          slug: org.slug,
          website: org.website ?? null,
          industry: org.industry ?? null,
          companySize: org.companySize ?? null,
          logoUrl: org.logoUrl ?? null,
        }}
      />
    </div>
  );
}

