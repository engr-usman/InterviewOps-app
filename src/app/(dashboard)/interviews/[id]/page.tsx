import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Recommendation } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { RecommendationBadge } from "@/components/ui/recommendation-badge";
import { prisma } from "@/lib/prisma";
import { InterviewQuestionTable } from "@/features/interviews/interview-question-table";
import { InterviewQuestionsManager } from "@/features/interviews/interview-questions-manager";
import { InterviewAiQuestionsManager } from "@/features/interviews/interview-ai-questions-manager";
import { ReopenInterviewButton } from "@/features/interviews/reopen-interview-button";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";
import { hasFeature } from "@/server/services/feature-flags";
import { generateInterviewReportAndRedirectAction } from "@/app/(dashboard)/reports/actions";
import { completeInterviewAction } from "@/app/(dashboard)/interviews/session-actions";

type Db = {
  interview: { findFirst: (args: unknown) => Promise<InterviewDetailRow | null> };
};

type InterviewDetailRow = {
  id: string;
  status: string;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  meetingUrl: string | null;
  notesText: string | null;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  candidate: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    location: string | null;
    seniorityLevel: string | null;
    aiMetadataJson: unknown;
  };
  jobDescription: {
    id: string;
    title: string;
    department: string | null;
    location: string | null;
    seniorityLevel: string | null;
    aiMetadataJson: unknown;
  };
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value);
}

function toRecommendation(value: string | null): Recommendation | null {
  if (!value) return null;
  if (value === "STRONG_HIRE") return "STRONG_HIRE";
  if (value === "HIRE") return "HIRE";
  if (value === "BORDERLINE") return "BORDERLINE";
  if (value === "NO_HIRE") return "NO_HIRE";
  if (value === "STRONG_NO_HIRE") return "STRONG_NO_HIRE";
  return null;
}

async function completeInterviewAndReturnAction(formData: FormData) {
  "use server";
  const interviewId = String(formData.get("interviewId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/interviews");
  if (!interviewId) redirect(returnTo);
  const result = await completeInterviewAction(interviewId);
  const sep = returnTo.includes("?") ? "&" : "?";
  if (!result.ok) redirect(`${returnTo}${sep}sessionError=${encodeURIComponent(result.error)}`);
  redirect(returnTo);
}

export default async function InterviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ reportError?: string; sessionError?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canConduct = hasPermission(ctx.role, "interview:conduct");
  const canManage = hasPermission(ctx.role, "interview:manage");
  const canManageQuestions = hasPermission(ctx.role, "interview:questions:manage");
  const canViewReports = hasPermission(ctx.role, "reports:view");
  const canGenerateReports = hasPermission(ctx.role, "reports:generate");
  const aiAllowed =
    canManage && hasPermission(ctx.role, "ai:use") ? await hasFeature(ctx.organization.id, "ai") : false;
  const exportsAllowed =
    canViewReports && hasPermission(ctx.role, "reports:export") ? await hasFeature(ctx.organization.id, "exports") : false;

  const canViewInterviews = hasPermission(ctx.role, "interview:view") || canConduct || canManage;
  if (!canViewInterviews) {
    return (
      <div className="space-y-6">
        <PageHeader title="Interview" description="Interview details and placeholders for session artifacts." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">You do not have permission to view interviews.</CardContent>
        </Card>
      </div>
    );
  }

  const { id } = await params;
  const { reportError, sessionError } = (await searchParams) ?? {};

  const interview = await (prisma as unknown as Db).interview.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: {
      id: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      startedAt: true,
      endedAt: true,
      meetingUrl: true,
      notesText: true,
      metadataJson: true,
      createdAt: true,
      updatedAt: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          location: true,
          seniorityLevel: true,
          aiMetadataJson: true,
        },
      },
      jobDescription: {
        select: {
          id: true,
          title: true,
          department: true,
          location: true,
          seniorityLevel: true,
          aiMetadataJson: true,
        },
      },
    },
  });

  if (!interview) notFound();

  const [interviewQuestions, evaluationScores, scorecard, questionsWithEval, latestReport] = await Promise.all([
    prisma.interviewQuestion.findMany({
      where: { interviewId: interview.id },
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        topic: true,
        questionText: true,
        type: true,
        difficulty: true,
        evaluation: { select: { score: true, metadataJson: true } },
      },
    }),
    prisma.interviewQuestionEvaluation.findMany({
      where: { interviewQuestion: { interviewId: interview.id } },
      select: { score: true },
      take: 200,
    }),
    prisma.evaluationScorecard.findUnique({
      where: { interviewId: interview.id },
      select: { recommendation: true, overallScore: true, summaryText: true, scorecardJson: true },
    }),
    prisma.interviewQuestion.findMany({
      where: { interviewId: interview.id },
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        topic: true,
        questionText: true,
        evaluation: { select: { score: true, updatedAt: true, metadataJson: true } },
      },
      take: 200,
    }),
    canViewReports
      ? prisma.report.findFirst({
          where: { organizationId: ctx.organization.id, interviewId: interview.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, type: true, createdAt: true, updatedAt: true, reportJson: true },
        })
      : Promise.resolve(null),
  ]);

  const topicsRows = canManage
    ? await prisma.questionBank.findMany({
        distinct: ["topic"],
        select: { topic: true },
        orderBy: { topic: "asc" },
      })
    : [];

  const questionBankOptions = canManage
    ? await prisma.questionBank.findMany({
        orderBy: [{ topic: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          topic: true,
          prompt: true,
          type: true,
          difficulty: true,
          seniorityLevel: true,
        },
        take: 1000,
      })
    : [];

  const topics = topicsRows.map((r) => r.topic);
  const scored = evaluationScores.map((e) => e.score).filter((s): s is number => typeof s === "number");
  const technicalAverage = scored.length === 0 ? null : Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100;
  const evaluatedCount = scored.length;
  const totalCount = interviewQuestions.length;
  const completionPct = totalCount === 0 ? 0 : Math.round((evaluatedCount / totalCount) * 100);
  const isScheduled = interview.status === "SCHEDULED";
  const isInProgress = interview.status === "IN_PROGRESS";
  const isCompleted = interview.status === "COMPLETED";
  const showNoQuestionsWarning = !isCompleted && totalCount === 0;
  const canLaunchSession = isCompleted || totalCount > 0;
  // Future Feature: Ad-Hoc Interview Mode
  // Purpose: Allow interviewers to conduct interviews without Question Bank questions and evaluate candidates using manual ratings only.
  const statusLabel = isScheduled ? "Scheduled" : isInProgress ? "In Progress" : isCompleted ? "Completed" : interview.status;
  const statusBadgeClassName = isCompleted
    ? "border-transparent bg-emerald-600 text-white"
    : isInProgress
      ? "border-transparent bg-blue-600 text-white"
      : "border-transparent bg-muted text-muted-foreground";
  const pendingCount = Math.max(0, totalCount - evaluatedCount);
  const skippedCount = 0;

  const allEvaluated =
    totalCount > 0 &&
    questionsWithEval.length === totalCount &&
    questionsWithEval.every((q) => {
      const meta = q.evaluation?.metadataJson as { status?: unknown } | null;
      const s = meta?.status;
      if (s === "EVALUATED") return true;
      return typeof q.evaluation?.score === "number";
    });
  const canCompleteInterview = interview.status === "IN_PROGRESS" && Boolean(scorecard) && allEvaluated;

  const reportBlockers: string[] = [];
  if (interview.status !== "COMPLETED") {
    reportBlockers.push("Complete the interview and save a scorecard before generating a report.");
  }
  if (interviewQuestions.length === 0) {
    reportBlockers.push("Add questions before generating a report.");
  }
  if (evaluatedCount === 0) {
    reportBlockers.push("Evaluate at least one question before generating a report.");
  }
  if (!scorecard) {
    reportBlockers.push("Save a scorecard before generating a report.");
  }
  const canGenerateReport = reportBlockers.length === 0;
  const aiCandidateSummary = (interview.candidate.aiMetadataJson as { resumeAnalysis?: unknown } | null)?.resumeAnalysis as
    | null
    | { profileSummary?: unknown };
  const aiJdSummary = (interview.jobDescription.aiMetadataJson as { jdAnalysis?: unknown } | null)?.jdAnalysis as
    | null
    | { summary?: unknown };
  const reopenedAtRaw = (interview.metadataJson as { reopenedAt?: unknown } | null)?.reopenedAt;
  const reopenedAtParsed =
    typeof reopenedAtRaw === "string" && reopenedAtRaw.trim().length > 0 ? new Date(reopenedAtRaw) : null;
  const reopenedAt = reopenedAtParsed && !Number.isNaN(reopenedAtParsed.getTime()) ? reopenedAtParsed : null;
  const showReopenedOutdatedReportWarning =
    Boolean(reopenedAt && latestReport?.updatedAt && latestReport.updatedAt < reopenedAt);
  const showInProgressExistingReportsWarning = Boolean(isInProgress && latestReport);

  const reportScorecard = (latestReport?.reportJson as { scorecard?: unknown } | null)?.scorecard as
    | null
    | { recommendation?: unknown; overallScore?: unknown };
  const reportRecommendation = typeof reportScorecard?.recommendation === "string" ? reportScorecard.recommendation : null;
  const reportOverallScore = typeof reportScorecard?.overallScore === "number" ? reportScorecard.overallScore : null;
  const scorecardRecommendation = typeof scorecard?.recommendation === "string" ? scorecard.recommendation : null;

  const scorecardJson = (scorecard?.scorecardJson ?? null) as
    | null
    | {
        communicationScore?: unknown;
        problemSolvingScore?: unknown;
        interviewerTechnicalAssessment?: unknown;
        cloudDevOpsScore?: unknown;
      };
  const communicationScore = typeof scorecardJson?.communicationScore === "number" ? scorecardJson.communicationScore : null;
  const problemSolvingScore = typeof scorecardJson?.problemSolvingScore === "number" ? scorecardJson.problemSolvingScore : null;
  const interviewerTechnicalAssessment =
    typeof scorecardJson?.interviewerTechnicalAssessment === "number"
      ? scorecardJson.interviewerTechnicalAssessment
      : typeof scorecardJson?.cloudDevOpsScore === "number"
        ? scorecardJson.cloudDevOpsScore
        : null;

  const startedAt = interview.startedAt;
  const endedAt = interview.endedAt;
  const durationMinutes =
    startedAt && endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60))) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Interview" description="Interview details and placeholders for session artifacts." />
        <div className="flex flex-col gap-2 sm:items-end">
          {!showNoQuestionsWarning && sessionError ? <div className="text-sm text-destructive">{sessionError}</div> : null}
          <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/interviews">Back to Interviews</Link>
          </Button>
          {canManage ? (
            <Button asChild>
              <Link href={`/interviews/${interview.id}/edit`}>Edit Interview</Link>
            </Button>
          ) : null}
          {isCompleted && canManage ? <ReopenInterviewButton interviewId={interview.id} /> : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Status</div>
            <div>{interview.status}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div>{formatDateTime(interview.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Scheduled start</div>
            <div>{interview.scheduledStartAt ? formatDateTime(interview.scheduledStartAt) : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Scheduled end</div>
            <div>{interview.scheduledEndAt ? formatDateTime(interview.scheduledEndAt) : "—"}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-muted-foreground">Meeting URL</div>
            <div>
              {interview.meetingUrl ? (
                <a className="text-primary underline-offset-4 hover:underline" href={interview.meetingUrl}>
                  {interview.meetingUrl}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-muted-foreground">Notes</div>
            <div className="whitespace-pre-wrap">{interview.notesText ? interview.notesText : "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Candidate summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Name</div>
            <div>
              <Link className="text-primary underline-offset-4 hover:underline" href={`/candidates/${interview.candidate.id}`}>
                {interview.candidate.fullName}
              </Link>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Seniority</div>
            <div>{interview.candidate.seniorityLevel ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Email</div>
            <div>{interview.candidate.email ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Location</div>
            <div>{interview.candidate.location ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job description summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Title</div>
            <div>
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href={`/job-descriptions/${interview.jobDescription.id}`}
              >
                {interview.jobDescription.title}
              </Link>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Seniority</div>
            <div>{interview.jobDescription.seniorityLevel ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Department</div>
            <div>{interview.jobDescription.department ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Location</div>
            <div>{interview.jobDescription.location ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-muted-foreground">Interview status</div>
              <div className="flex items-center gap-2">
                <Badge className={statusBadgeClassName}>{statusLabel}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isCompleted || (canConduct && canLaunchSession) ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/interviews/${interview.id}/session`}>
                    {isCompleted ? "View Session" : isInProgress ? "Continue Interview Session" : "Start Interview Session"}
                  </Link>
                </Button>
              ) : (
                <span title={canConduct ? "Add at least one question before starting the interview." : "You do not have permission to conduct interviews."}>
                  <Button size="sm" variant="outline" disabled>
                    Start Interview Session
                  </Button>
                </span>
              )}
              {latestReport && canViewReports ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/reports/${latestReport.id}`}>View Report</Link>
                </Button>
              ) : null}
              {canCompleteInterview ? (
                <form action={completeInterviewAndReturnAction}>
                  <input type="hidden" name="interviewId" value={interview.id} />
                  <input type="hidden" name="returnTo" value={`/interviews/${interview.id}`} />
                  <FormSubmitButton size="sm" pendingText="Completing...">
                    Complete Interview
                  </FormSubmitButton>
                </form>
              ) : null}
              {canGenerateReports && isCompleted ? (
                <form action={generateInterviewReportAndRedirectAction}>
                  <input type="hidden" name="interviewId" value={interview.id} />
                  <input type="hidden" name="type" value="FULL" />
                  <input type="hidden" name="force" value="0" />
                  <input type="hidden" name="returnTo" value={`/interviews/${interview.id}`} />
                  <FormSubmitButton size="sm" disabled={!canGenerateReport} pendingText="Generating...">
                    Generate Report
                  </FormSubmitButton>
                </form>
              ) : null}
            </div>
          </div>

          {showNoQuestionsWarning ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <div className="font-medium">⚠ No interview questions have been added.</div>
              <div className="text-amber-800">Add at least one question before starting the interview.</div>
            </div>
          ) : null}
          {!showNoQuestionsWarning && !startedAt ? (
            <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground">
              Interview session has not been started.
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-4">
              <div className="text-sm font-medium">Progress</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Questions evaluated</div>
                  <div>
                    {evaluatedCount} / {totalCount}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Completion</div>
                  <div>{completionPct}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Technical average</div>
                  <div>{typeof technicalAverage === "number" ? `${technicalAverage.toFixed(2)} / 10` : "Not available"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Communication</div>
                  <div>{typeof communicationScore === "number" ? `${communicationScore.toFixed(2)} / 10` : "Not available"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Problem solving</div>
                  <div>{typeof problemSolvingScore === "number" ? `${problemSolvingScore.toFixed(2)} / 10` : "Not available"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Interviewer Technical Assessment</div>
                  <div>
                    {typeof interviewerTechnicalAssessment === "number"
                      ? `${interviewerTechnicalAssessment.toFixed(2)} / 10`
                      : "Not available"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Overall score</div>
                  <div>{typeof scorecard?.overallScore === "number" ? `${scorecard.overallScore.toFixed(2)} / 10` : "Not available"}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground">Recommendation</div>
                  <div className="mt-1">
                    <RecommendationBadge value={toRecommendation(scorecardRecommendation)} emptyLabel="Not Submitted" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border p-4">
              <div className="text-sm font-medium">Question stats</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Questions</div>
                  <div>{totalCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Evaluated</div>
                  <div>{evaluatedCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pending</div>
                  <div>{pendingCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Skipped</div>
                  <div>{skippedCount}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <div className="text-sm font-medium">Timeline</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-muted-foreground">Created</div>
                <div>{formatDate(interview.createdAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Started</div>
                <div>{startedAt ? formatDateTime(startedAt) : "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Completed</div>
                <div>{endedAt ? formatDateTime(endedAt) : "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Duration</div>
                <div>{endedAt && typeof durationMinutes === "number" ? `${durationMinutes} minutes` : startedAt ? "Running..." : "—"}</div>
              </div>
            </div>
          </div>

          {latestReport ? (
            <div className="rounded-md border p-4">
              <div className="text-sm font-medium">Report</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-muted-foreground">Latest Report</div>
                  <div>{String(latestReport.type)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Score</div>
                  <div>{typeof reportOverallScore === "number" ? reportOverallScore.toFixed(2) : "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Recommendation</div>
                  <div className="mt-1">
                    <RecommendationBadge value={toRecommendation(reportRecommendation)} emptyLabel="—" />
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Generated</div>
                  <div>{formatDate(latestReport.createdAt)}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/reports/${latestReport.id}`}>View Report</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isCompleted ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              This interview is completed. Reopen the interview to modify questions or evaluations.
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="text-sm font-medium">Current questions</div>
            {interviewQuestions.length === 0 ? (
              <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                No interview questions have been added. Add at least one question before starting the interview.
              </div>
            ) : (
              <InterviewQuestionTable
                interviewId={interview.id}
                readOnly={isCompleted}
                canManage={!isCompleted && canManageQuestions}
                rows={interviewQuestions.map((q) => ({
                  id: q.id,
                  order: q.order,
                  topic: q.topic ?? "—",
                  questionText: q.questionText,
                  type: q.type,
                  difficulty: q.difficulty,
                  evaluation: q.evaluation ? { score: q.evaluation.score, metadataJson: q.evaluation.metadataJson } : null,
                }))}
              />
            )}
          </div>

          {!isCompleted && canManageQuestions ? (
            <InterviewQuestionsManager interviewId={interview.id} topics={topics} questionBankOptions={questionBankOptions} />
          ) : null}
          {!isCompleted && aiAllowed ? <InterviewAiQuestionsManager interviewId={interview.id} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scorecard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground">Completion</div>
              <div>{completionPct}%</div>
            </div>
            <div>
              <div className="text-muted-foreground">Technical average</div>
              <div>{typeof technicalAverage === "number" ? technicalAverage.toFixed(2) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Overall score</div>
              <div>{typeof scorecard?.overallScore === "number" ? scorecard.overallScore.toFixed(2) : "—"}</div>
            </div>
          </div>

          {scorecard ? (
            <div className="space-y-2">
              <div>
                <div className="text-muted-foreground">Recommendation</div>
                <div>{scorecard.recommendation ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Summary</div>
                <div className="whitespace-pre-wrap">{scorecard.summaryText ? scorecard.summaryText : "—"}</div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">No scorecard saved yet. Use the session screen to evaluate and save.</div>
          )}

          {canViewReports ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
              {reportError ? <div className="w-full text-sm text-destructive">{reportError}</div> : null}
              {showReopenedOutdatedReportWarning ? (
                <div className="w-full rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  This interview was reopened after report generation. Existing reports may be outdated. Regenerate the report
                  after completing the interview again.
                </div>
              ) : null}
              {showInProgressExistingReportsWarning ? (
                <div className="w-full rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  This interview has existing reports, but the interview is currently in progress. Reports may be outdated.
                </div>
              ) : null}
              {canGenerateReports && !canGenerateReport ? (
                <div className="w-full space-y-1 text-sm text-muted-foreground">
                  {reportBlockers.map((msg) => (
                    <div key={msg}>{msg}</div>
                  ))}
                </div>
              ) : null}
              {!canGenerateReports ? (
                <div className="w-full text-sm text-muted-foreground">You do not have permission to generate reports.</div>
              ) : null}
              {latestReport ? (
                <>
                  <div className="w-full rounded-md border p-3 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <div className="text-muted-foreground">Report type</div>
                        <div>{String(latestReport.type)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Recommendation</div>
                        <div className="mt-1">
                          <RecommendationBadge value={toRecommendation(reportRecommendation)} emptyLabel="—" />
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Score</div>
                        <div>{typeof reportOverallScore === "number" ? reportOverallScore.toFixed(2) : "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Created</div>
                        <div>{formatDateTime(latestReport.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/reports/${latestReport.id}`}>View Report</Link>
                  </Button>
                  {exportsAllowed ? (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/api/reports/${latestReport.id}/json`}>Export JSON</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/api/reports/${latestReport.id}/csv`}>Export CSV</Link>
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      Export (upgrade)
                    </Button>
                  )}
                  {canGenerateReports ? (
                    <form action={generateInterviewReportAndRedirectAction}>
                      <input type="hidden" name="interviewId" value={interview.id} />
                      <input type="hidden" name="type" value="FULL" />
                      <input type="hidden" name="force" value="1" />
                      <input type="hidden" name="returnTo" value={`/interviews/${interview.id}`} />
                      <FormSubmitButton size="sm" disabled={!canGenerateReport} pendingText="Regenerating...">
                        Regenerate Report
                      </FormSubmitButton>
                    </form>
                  ) : null}
                </>
              ) : (
                canGenerateReports ? (
                  <form action={generateInterviewReportAndRedirectAction}>
                    <input type="hidden" name="interviewId" value={interview.id} />
                    <input type="hidden" name="type" value="FULL" />
                    <input type="hidden" name="force" value="0" />
                    <input type="hidden" name="returnTo" value={`/interviews/${interview.id}`} />
                    <FormSubmitButton size="sm" disabled={!canGenerateReport} pendingText="Generating...">
                      Generate Report
                    </FormSubmitButton>
                  </form>
                ) : null
              )}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-4">
              <div className="text-sm font-medium">Question performance</div>
              <div className="mt-2 space-y-2">
                {questionsWithEval.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No questions yet.</div>
                ) : (
                  questionsWithEval.slice(0, 12).map((q) => (
                    <div key={q.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="text-muted-foreground">
                        {q.order}. {q.topic ?? "—"}
                      </div>
                      <div>{typeof q.evaluation?.score === "number" ? q.evaluation.score : "—"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-md border p-4">
              <div className="text-sm font-medium">Evaluation timeline</div>
              <div className="mt-2 space-y-2">
                {questionsWithEval.filter((q) => q.evaluation?.updatedAt).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No evaluations yet.</div>
                ) : (
                  questionsWithEval
                    .filter((q) => q.evaluation?.updatedAt)
                    .slice()
                    .sort((a, b) => (b.evaluation?.updatedAt?.getTime() ?? 0) - (a.evaluation?.updatedAt?.getTime() ?? 0))
                    .slice(0, 8)
                    .map((q) => (
                      <div key={q.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="text-muted-foreground">
                          {q.order}. {q.topic ?? "—"}
                        </div>
                        <div className="text-muted-foreground">
                          {q.evaluation?.updatedAt ? formatDateTime(q.evaluation.updatedAt) : "—"}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <div className="text-sm font-medium">AI insight summary</div>
            <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Candidate snapshot</div>
                <div className="text-muted-foreground">
                  {typeof aiCandidateSummary?.profileSummary === "string" ? (aiCandidateSummary.profileSummary as string) : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Role snapshot</div>
                <div className="text-muted-foreground">{typeof aiJdSummary?.summary === "string" ? (aiJdSummary.summary as string) : "—"}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
