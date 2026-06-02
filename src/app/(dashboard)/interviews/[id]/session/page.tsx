import { notFound, redirect } from "next/navigation";
import type { Recommendation } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { InterviewSessionConsole } from "@/features/interviews/interview-session-console";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

type InterviewSessionRow = {
  id: string;
  status: string;
  candidate: { id: string; fullName: string; email: string | null; seniorityLevel: string | null };
  jobDescription: { id: string; title: string; seniorityLevel: string | null };
  questions: Array<{
    id: string;
    order: number;
    topic: string | null;
    questionText: string;
    type: string;
    difficulty: string;
    tagsJson: unknown;
    evaluation: {
      id: string;
      score: number | null;
      notesText: string | null;
      metadataJson: unknown;
      updatedAt: Date;
    } | null;
  }>;
  scorecard: {
    id: string;
    recommendation: Recommendation | null;
    overallScore: number | null;
    summaryText: string | null;
    scorecardJson: unknown;
    metadataJson: unknown;
  } | null;
};

type Db = {
  interview: { findFirst: (args: unknown) => Promise<InterviewSessionRow | null> };
  report: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
};

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canConduct = hasPermission(ctx.role, "interview:conduct");
  const canView = hasPermission(ctx.role, "interview:view") || canConduct || hasPermission(ctx.role, "interview:manage");
  const canViewReports = hasPermission(ctx.role, "reports:view");
  const canGenerateReports = hasPermission(ctx.role, "reports:generate");

  const { id } = await params;

  const interview = await (prisma as unknown as Db).interview.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: {
      id: true,
      status: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
          email: true,
          seniorityLevel: true,
        },
      },
      jobDescription: {
        select: {
          id: true,
          title: true,
          seniorityLevel: true,
        },
      },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          topic: true,
          questionText: true,
          type: true,
          difficulty: true,
          tagsJson: true,
          evaluation: {
            select: {
              id: true,
              score: true,
              notesText: true,
              metadataJson: true,
              updatedAt: true,
            },
          },
        },
      },
      scorecard: {
        select: {
          id: true,
          recommendation: true,
          overallScore: true,
          summaryText: true,
          scorecardJson: true,
          metadataJson: true,
        },
      },
    },
  });

  if (!interview) notFound();

  const latestReport = (await (prisma as unknown as Db).report.findFirst({
    where: { interviewId: interview.id, organizationId: ctx.organization.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  })) as { id: string } | null;

  if (!canView) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">You do not have permission to view interviews.</CardContent>
      </Card>
    );
  }

  if (!canConduct && interview.status !== "COMPLETED") {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          You do not have permission to conduct interviews.
        </CardContent>
      </Card>
    );
  }

  if ((interview.status === "SCHEDULED" || interview.status === "IN_PROGRESS") && interview.questions.length === 0) {
    redirect(
      `/interviews/${interview.id}?sessionError=${encodeURIComponent(
        "No interview questions have been added. Add at least one question before starting the interview.",
      )}`,
    );
  }

  let effectiveStatus = interview.status;
  if (canConduct && (interview.status === "SCHEDULED" || interview.status === "DRAFT")) {
    const now = new Date();
    const updatedWithStartedAt = await prisma.interview.updateMany({
      where: {
        id: interview.id,
        organizationId: ctx.organization.id,
        status: { in: ["SCHEDULED", "DRAFT"] },
        startedAt: null,
      },
      data: {
        status: "IN_PROGRESS",
        startedAt: now,
      },
    });
    if (updatedWithStartedAt.count === 0) {
      await prisma.interview.updateMany({
        where: {
          id: interview.id,
          organizationId: ctx.organization.id,
          status: { in: ["SCHEDULED", "DRAFT"] },
        },
        data: { status: "IN_PROGRESS" },
      });
    }
    effectiveStatus = "IN_PROGRESS";
  }

  return (
    <InterviewSessionConsole
      interviewId={interview.id}
      interviewStatus={effectiveStatus}
      candidate={interview.candidate}
      jobDescription={interview.jobDescription}
      questions={interview.questions.map((q) => ({
        ...q,
        evaluation: q.evaluation
          ? { ...q.evaluation, updatedAt: q.evaluation.updatedAt.toISOString() }
          : null,
      }))}
      scorecard={interview.scorecard ?? null}
      latestReportId={latestReport?.id ?? null}
      canViewReports={canViewReports}
      canGenerateReports={canGenerateReports}
    />
  );
}
