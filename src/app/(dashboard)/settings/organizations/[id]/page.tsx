import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrThrow } from "@/server/services/org-context";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function OrganizationDetailAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  if (ctx.role !== "OWNER") {
    return (
      <div className="space-y-6">
        <PageHeader title="Organization" description="Organization details" />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Access denied.</CardContent>
        </Card>
      </div>
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
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, plan: { select: { code: true, name: true } } },
      },
      _count: { select: { members: true, candidates: true, interviews: true } },
    },
  });
  if (!org) notFound();

  const plan = org.subscriptions[0]?.plan.code ?? "FREE";
  const createdBy = org.createdBy?.name?.trim() || org.createdBy?.email || "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={org.name} description="Organization details" />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/settings/organizations">Back</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/settings/organizations/${org.id}/edit`}>Edit</Link>
          </Button>
          <Button asChild variant="destructive">
            <Link href={`/settings/organizations/${org.id}/delete`}>Delete</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span>Overview</span>
            <Badge variant="outline">{String(plan)}</Badge>
            {org.subscriptions[0]?.status ? <Badge variant="secondary">{String(org.subscriptions[0].status)}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Slug</div>
            <div className="font-medium">{org.slug}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Created by</div>
            <div className="font-medium">{createdBy}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Members</div>
            <div className="font-medium">{org._count.members}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Candidates</div>
            <div className="font-medium">{org._count.candidates}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Interviews</div>
            <div className="font-medium">{org._count.interviews}</div>
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
          <div>
            <div className="text-muted-foreground">Created</div>
            <div className="font-medium">{formatDateTime(org.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Updated</div>
            <div className="font-medium">{formatDateTime(org.updatedAt)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

