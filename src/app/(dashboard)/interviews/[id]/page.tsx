import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { InterviewQuestionTable } from "@/features/interviews/interview-question-table";
import { InterviewQuestionsManager } from "@/features/interviews/interview-questions-manager";
import { InterviewAiQuestionsManager } from "@/features/interviews/interview-ai-questions-manager";
import { ReopenInterviewButton } from "@/features/interviews/reopen-interview-button";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";
import { hasFeature } from "@/server/services/feature-flags";
import { generateInterviewReportAndRedirectAction } from "@/app/(dashboard)/reports/actions";
import { ReportType } from "@prisma/client";

type Db = {
  interview: { findFirst: (args: unknown) => Promise<InterviewDetailRow | null> };
};

type InterviewDetailRow = {
  id: string;
  status: string;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
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
  const canViewReports = hasPermission(ctx.role, "reports:view");
  const aiAllowed =
    canManage && hasPermission(ctx.role, "ai:use") ? await hasFeature(ctx.organization.id, "ai") : false;
  const exportsAllowed = canViewReports ? await hasFeature(ctx.organization.id, "exports") : false;

  if (!canConduct) {
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

  const [interviewQuestions, evaluationScores, scorecard, questionsWithEval, existingReport] = await Promise.all([
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
        evaluation: { select: { score: true, updatedAt: true } },
      },
      take: 200,
    }),
    canViewReports
      ? prisma.report.findFirst({
          where: { organizationId: ctx.organization.id, interviewId: interview.id, type: ReportType.FULL },
          orderBy: { updatedAt: "desc" },
          select: { id: true, updatedAt: true },
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
  const noQuestions = interviewQuestions.length === 0;
  const isScheduled = interview.status === "SCHEDULED";
  const isInProgress = interview.status === "IN_PROGRESS";
  const isCompleted = interview.status === "COMPLETED";
  const canStartSession = !(isScheduled && noQuestions);

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
  const showOutdatedReportWarning =
    Boolean(reopenedAt && existingReport?.updatedAt && existingReport.updatedAt < reopenedAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Interview" description="Interview details and placeholders for session artifacts." />
        <div className="flex flex-col gap-2 sm:items-end">
          {sessionError ? <div className="text-sm text-destructive">{sessionError}</div> : null}
          {!canStartSession ? (
            <div className="text-sm text-muted-foreground">
              Add questions before starting the interview, or use ad-hoc interview mode.
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/interviews">Back to Interviews</Link>
          </Button>
          {isCompleted ? (
            <Button asChild variant="outline">
              <Link href={`/interviews/${interview.id}/session`}>View Session</Link>
            </Button>
          ) : canStartSession ? (
            <Button asChild variant="outline">
              <Link href={`/interviews/${interview.id}/session`}>{isInProgress ? "Continue Interview Session" : "Start Interview Session"}</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Start Interview Session
            </Button>
          )}
          {isCompleted && canManage ? <ReopenInterviewButton interviewId={interview.id} /> : null}
          {!canStartSession ? (
            <Button asChild variant="outline">
              <Link href={`/interviews/${interview.id}/session?adhoc=1`}>Ad-hoc Mode</Link>
            </Button>
          ) : null}
          {canManage ? (
            <Button asChild>
              <Link href={`/interviews/${interview.id}/edit`}>Edit Interview</Link>
            </Button>
          ) : null}
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
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {aiAllowed ? <InterviewAiQuestionsManager interviewId={interview.id} /> : null}
          {canManage ? (
            <InterviewQuestionsManager interviewId={interview.id} topics={topics} questionBankOptions={questionBankOptions} />
          ) : null}

          <div className="space-y-2">
            <div className="text-sm font-medium">Current questions</div>
            {interviewQuestions.length === 0 ? (
              <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                No questions yet. Generate a set or add a question manually.
              </div>
            ) : (
              <InterviewQuestionTable
                interviewId={interview.id}
                rows={interviewQuestions.map((q) => ({
                  id: q.id,
                  order: q.order,
                  topic: q.topic ?? "—",
                  questionText: q.questionText,
                  type: q.type,
                  difficulty: q.difficulty,
                }))}
              />
            )}
          </div>
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
              {showOutdatedReportWarning ? (
                <div className="w-full rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  This interview was reopened after report generation. Existing reports may be outdated. Regenerate the report
                  after completing the interview again.
                </div>
              ) : null}
              {!canGenerateReport ? (
                <div className="w-full space-y-1 text-sm text-muted-foreground">
                  {reportBlockers.map((msg) => (
                    <div key={msg}>{msg}</div>
                  ))}
                </div>
              ) : null}
              {existingReport ? (
                <>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/reports/${existingReport.id}`}>View Report</Link>
                  </Button>
                  {exportsAllowed ? (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/api/reports/${existingReport.id}/json`}>Export JSON</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/api/reports/${existingReport.id}/csv`}>Export CSV</Link>
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      Export (upgrade)
                    </Button>
                  )}
                  <form action={generateInterviewReportAndRedirectAction}>
                    <input type="hidden" name="interviewId" value={interview.id} />
                    <input type="hidden" name="type" value="FULL" />
                    <input type="hidden" name="force" value="1" />
                    <input type="hidden" name="returnTo" value={`/interviews/${interview.id}`} />
                    <Button type="submit" size="sm" disabled={!canGenerateReport}>
                      Regenerate Report
                    </Button>
                  </form>
                </>
              ) : (
                <form action={generateInterviewReportAndRedirectAction}>
                  <input type="hidden" name="interviewId" value={interview.id} />
                  <input type="hidden" name="type" value="FULL" />
                  <input type="hidden" name="force" value="0" />
                  <input type="hidden" name="returnTo" value={`/interviews/${interview.id}`} />
                  <Button type="submit" size="sm" disabled={!canGenerateReport}>
                    Generate Report
                  </Button>
                </form>
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

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/interviews/${interview.id}/session`}>Open session</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
