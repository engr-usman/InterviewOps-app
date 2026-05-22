import { notFound, redirect } from "next/navigation";
import type { InterviewStatus } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { updateInterviewAction } from "@/app/(dashboard)/interviews/actions";
import { InterviewForm } from "@/features/interviews/interview-form";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

type Db = {
  interview: { findFirst: (args: unknown) => Promise<unknown> };
  candidate: { findMany: (args: unknown) => Promise<Array<{ id: string; fullName: string }>> };
  jobDescription: { findMany: (args: unknown) => Promise<Array<{ id: string; title: string }>> };
};

function toDatetimeLocalValue(date: Date | null) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export default async function EditInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManage = hasPermission(ctx.role, "interview:manage");

  const { id } = await params;

  const db = prisma as unknown as Db;
  const interview = canManage
    ? await db.interview.findFirst({
        where: { id, organizationId: ctx.organization.id },
        select: {
          id: true,
          candidateId: true,
          jobDescriptionId: true,
          status: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
          meetingUrl: true,
          notesText: true,
        },
      }) as
          | {
              id: string;
              candidateId: string;
              jobDescriptionId: string;
              status: InterviewStatus;
              scheduledStartAt: Date | null;
              scheduledEndAt: Date | null;
              meetingUrl: string | null;
              notesText: string | null;
            }
          | null
    : null;

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit interview" description="Update interview details and scheduling." />
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">You do not have permission to edit interviews.</CardContent>
        </Card>
      </div>
    );
  }

  if (!interview) notFound();

  const candidates: Array<{ id: string; fullName: string }> = await db.candidate.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  const jobDescriptions: Array<{ id: string; title: string }> = await db.jobDescription.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Edit interview" description="Update interview details and scheduling." />
      <InterviewForm
        mode="edit"
        title="Interview details"
        description="Update scheduling, links, and status."
        submitLabel="Save changes"
        candidates={candidates}
        jobDescriptions={jobDescriptions}
        initialValues={{
          candidateId: interview.candidateId,
          jobDescriptionId: interview.jobDescriptionId,
          status: interview.status,
          scheduledStartAt: toDatetimeLocalValue(interview.scheduledStartAt),
          scheduledEndAt: toDatetimeLocalValue(interview.scheduledEndAt),
          meetingUrl: interview.meetingUrl ?? "",
          notesText: interview.notesText ?? "",
        }}
        onSubmitAction={(values) => updateInterviewAction(interview.id, values)}
      />
    </div>
  );
}
