import { redirect } from "next/navigation";
import { InterviewStatus } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { createInterviewAction } from "@/app/(dashboard)/interviews/actions";
import { InterviewForm } from "@/features/interviews/interview-form";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

type Db = {
  candidate: { findMany: (args: unknown) => Promise<Array<{ id: string; fullName: string }>> };
  jobDescription: { findMany: (args: unknown) => Promise<Array<{ id: string; title: string }>> };
  organizationMember: {
    findMany: (args: unknown) => Promise<Array<{ role: string; user: { id: string; name: string | null; email: string } }>>;
  };
};

export default async function NewInterviewPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManage = hasPermission(ctx.role, "interview:manage");

  const db = prisma as unknown as Db;
  const candidates: Array<{ id: string; fullName: string }> = canManage
    ? await db.candidate.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true },
      })
    : [];

  const jobDescriptions: Array<{ id: string; title: string }> = canManage
    ? await db.jobDescription.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      })
    : [];

  const interviewers = canManage
    ? await db.organizationMember.findMany({
        where: { organizationId: ctx.organization.id, role: { in: ["OWNER", "ADMIN", "INTERVIEWER"] } },
        orderBy: [{ role: "asc" }, { user: { email: "asc" } }],
        select: { role: true, user: { select: { id: true, name: true, email: true } } },
        take: 200,
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Create interview" description="Link a candidate to a job description." />
      {canManage ? (
        <InterviewForm
          mode="create"
          title="Interview details"
          description="You can schedule times and add meeting details now. Live session UI comes next."
          submitLabel="Create interview"
          candidates={candidates}
          jobDescriptions={jobDescriptions}
          interviewers={interviewers.map((m) => ({ userId: m.user.id, name: m.user.name ?? null, email: m.user.email, role: m.role }))}
          initialValues={{
            status: InterviewStatus.DRAFT,
          }}
          action={createInterviewAction}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">You do not have permission to create interviews.</CardContent>
        </Card>
      )}
    </div>
  );
}
