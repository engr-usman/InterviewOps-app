import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import {
  JobDescriptionTable,
  type JobDescriptionListRow,
} from "@/features/job-descriptions/job-description-table";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { canManageJobDescriptions } from "@/server/services/rbac";

type Db = {
  jobDescription: {
    findMany: (args: unknown) => Promise<JobDescriptionListRow[]>;
  };
};

export default async function JobDescriptionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManage = canManageJobDescriptions(ctx.role);

  const { q } = (await searchParams) ?? {};
  const query = q?.trim();

  let rows: JobDescriptionListRow[] = [];
  let loadError: string | null = null;

  try {
    const db = prisma as unknown as Db;
    rows = await db.jobDescription.findMany({
      where: {
        organizationId: ctx.organization.id,
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { department: { contains: query, mode: "insensitive" } },
                { location: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        department: true,
        location: true,
        seniorityLevel: true,
        createdAt: true,
      },
    });
  } catch {
    loadError = "Failed to load job descriptions.";
  }

  return (
    <div>
      <PageHeader title="Job Descriptions" description="Create and manage job descriptions for interviews." />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form className="flex w-full max-w-md items-center gap-2" action="/job-descriptions" method="get">
          <Input name="q" placeholder="Search by title, department, or location…" defaultValue={query ?? ""} />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        {canManage ? (
          <Button asChild>
            <Link href="/job-descriptions/new">Add Job Description</Link>
          </Button>
        ) : null}
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">No job descriptions yet</div>
              <div className="text-sm text-muted-foreground">
                Create your first job description to start linking interviews to roles.
              </div>
              {canManage ? (
                <div className="pt-2">
                  <Button asChild>
                    <Link href="/job-descriptions/new">Add Job Description</Link>
                  </Button>
                </div>
              ) : (
                <div className="pt-2 text-sm text-muted-foreground">Ask an admin to create job descriptions.</div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <JobDescriptionTable rows={rows} canManage={canManage} />
      )}
    </div>
  );
}
