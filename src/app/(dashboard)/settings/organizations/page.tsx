import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrThrow } from "@/server/services/org-context";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(value);
}

export default async function OrganizationManagementPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  if (ctx.role !== "OWNER") {
    return (
      <div className="space-y-6">
        <PageHeader title="Organization Management" description="Internal admin tools for organizations." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Access denied.</CardContent>
        </Card>
      </div>
    );
  }

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, plan: { select: { code: true } } },
      },
      _count: { select: { members: true, candidates: true, interviews: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Organization Management" description="Internal admin tools for organizations." />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/settings">Back to Settings</Link>
          </Button>
          <Button asChild>
            <Link href="/onboarding?mode=create">Create Organization</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Candidates</TableHead>
                <TableHead className="text-right">Interviews</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((o) => {
                const plan = o.subscriptions[0]?.plan.code ?? "FREE";
                const createdBy = o.createdBy?.name?.trim() || o.createdBy?.email || "—";
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell className="text-muted-foreground">{o.slug}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{String(plan)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{createdBy}</TableCell>
                    <TableCell className="text-right">{o._count.members}</TableCell>
                    <TableCell className="text-right">{o._count.candidates}</TableCell>
                    <TableCell className="text-right">{o._count.interviews}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/settings/organizations/${o.id}`}>View</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/settings/organizations/${o.id}/edit`}>Edit</Link>
                        </Button>
                        <Button asChild size="sm" variant="destructive">
                          <Link href={`/settings/organizations/${o.id}/delete`}>Delete</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

