import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { InterviewQuestionTable } from "@/features/interviews/interview-question-table";
import { InterviewQuestionsManager } from "@/features/interviews/interview-questions-manager";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function InterviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const interview = await prisma.interview.findFirst({
    where: { id, createdById: session.user.id },
    select: {
      id: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      meetingUrl: true,
      notesText: true,
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
        },
      },
      jobDescription: {
        select: {
          id: true,
          title: true,
          department: true,
          location: true,
          seniorityLevel: true,
        },
      },
    },
  });

  if (!interview) notFound();

  const [topicsRows, questionBankOptions, interviewQuestions, evaluationScores, scorecard] = await Promise.all([
    prisma.questionBank.findMany({
      distinct: ["topic"],
      select: { topic: true },
      orderBy: { topic: "asc" },
    }),
    prisma.questionBank.findMany({
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
    }),
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
  ]);

  const topics = topicsRows.map((r) => r.topic);
  const scored = evaluationScores.map((e) => e.score).filter((s): s is number => typeof s === "number");
  const technicalAverage = scored.length === 0 ? null : Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100;
  const evaluatedCount = scored.length;
  const totalCount = interviewQuestions.length;
  const completionPct = totalCount === 0 ? 0 : Math.round((evaluatedCount / totalCount) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Interview" description="Interview details and placeholders for session artifacts." />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/interviews">Back to Interviews</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/interviews/${interview.id}/session`}>Start Interview Session</Link>
          </Button>
          <Button asChild>
            <Link href={`/interviews/${interview.id}/edit`}>Edit Interview</Link>
          </Button>
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
          <InterviewQuestionsManager interviewId={interview.id} topics={topics} questionBankOptions={questionBankOptions} />

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

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/interviews/${interview.id}/session`}>Open session</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" disabled>
              Generate Report (placeholder)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Reports will be generated after the interview session is completed.
        </CardContent>
      </Card>
    </div>
  );
}
