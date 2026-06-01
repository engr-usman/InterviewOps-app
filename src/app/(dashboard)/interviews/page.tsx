import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InterviewStatus, SeniorityLevel } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { InterviewTable, type InterviewListRow } from "@/features/interviews/interview-table";
import { statusOptions } from "@/features/interviews/interview-schema";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

type Db = {
  candidate: { findMany: (args: unknown) => Promise<Array<{ id: string; fullName: string }>> };
  jobDescription: { findMany: (args: unknown) => Promise<Array<{ id: string; title: string; seniorityLevel: SeniorityLevel | null }>> };
  interview: { findMany: (args: unknown) => Promise<InterviewListRow[]> };
};

function asEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    candidateId?: string;
    jobDescriptionId?: string;
    seniorityLevel?: string;
  }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canAccess = hasPermission(ctx.role, "interview:view") || hasPermission(ctx.role, "interview:conduct") || hasPermission(ctx.role, "interview:manage");
  const canManage = hasPermission(ctx.role, "interview:manage");

  if (!canAccess) {
    return (
      <div>
        <PageHeader title="Interviews" description="Create and manage interview sessions." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">You do not have permission to view interviews.</CardContent>
        </Card>
      </div>
    );
  }

  const params = (await searchParams) ?? {};
  const q = params.q?.trim();
  const candidateId = params.candidateId?.trim();
  const jobDescriptionId = params.jobDescriptionId?.trim();

  const statusValues = Object.values(InterviewStatus) as InterviewStatus[];
  const seniorityValues = Object.values(SeniorityLevel) as SeniorityLevel[];

  const status = asEnum(params.status, statusValues);
  const seniorityLevel = asEnum(params.seniorityLevel, seniorityValues);

  const db = prisma as unknown as Db;
  const candidates: Array<{ id: string; fullName: string }> = await db.candidate.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  const jobDescriptions: Array<{ id: string; title: string; seniorityLevel: SeniorityLevel | null }> =
    await db.jobDescription.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true, seniorityLevel: true },
    });

  let rows: InterviewListRow[] = [];
  let loadError: string | null = null;

  try {
    rows = await db.interview.findMany({
      where: {
        organizationId: ctx.organization.id,
        ...(q
          ? {
              OR: [
                { candidate: { fullName: { contains: q, mode: "insensitive" } } },
                { jobDescription: { title: { contains: q, mode: "insensitive" } } },
                { meetingUrl: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(status ? { status } : {}),
        ...(candidateId ? { candidateId } : {}),
        ...(jobDescriptionId ? { jobDescriptionId } : {}),
        ...(seniorityLevel
          ? {
              OR: [
                { candidate: { seniorityLevel } },
                { jobDescription: { seniorityLevel } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        status: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        createdAt: true,
        candidate: { select: { id: true, fullName: true } },
        jobDescription: { select: { id: true, title: true } },
      },
    });
  } catch {
    loadError = "Failed to load interviews.";
  }

  return (
    <div>
      <PageHeader title="Interviews" description="Create and manage interview sessions." />

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form className="flex w-full max-w-md items-center gap-2" action="/interviews" method="get">
            <Input name="q" placeholder="Search candidate, job description, meeting URL…" defaultValue={q ?? ""} />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/interviews">Clear</Link>
            </Button>
            {canManage ? (
              <Button asChild>
                <Link href="/interviews/new">Create Interview</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-4" action="/interviews" method="get">
          <input type="hidden" name="q" value={q ?? ""} />

          <div className="space-y-1">
            <div className="text-sm font-medium">Status</div>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Candidate</div>
            <select
              name="candidateId"
              defaultValue={candidateId ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Job description</div>
            <select
              name="jobDescriptionId"
              defaultValue={jobDescriptionId ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All</option>
              {jobDescriptions.map((jd) => (
                <option key={jd.id} value={jd.id}>
                  {jd.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Seniority</div>
            <select
              name="seniorityLevel"
              defaultValue={seniorityLevel ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All</option>
              <option value="INTERN">Intern</option>
              <option value="JUNIOR">Junior</option>
              <option value="MID">Mid</option>
              <option value="SENIOR">Senior</option>
              <option value="STAFF">Staff</option>
              <option value="PRINCIPAL">Principal</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <Button type="submit" variant="outline">
              Apply filters
            </Button>
          </div>
        </form>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">No interviews yet</div>
              <div className="text-sm text-muted-foreground">
                Create an interview to tie a candidate to a job description and track the session lifecycle.
              </div>
              {canManage ? (
                <div className="pt-2">
                  <Button asChild>
                    <Link href="/interviews/new">Create Interview</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
      <InterviewTable rows={rows} canManage={canManage} />
      )}
    </div>
  );
}
