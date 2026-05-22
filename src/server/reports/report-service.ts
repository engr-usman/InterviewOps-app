import { prisma } from "@/lib/prisma";
import type { InterviewReport, ReportFormat } from "@/lib/reports/types";

type Db = {
  interview: {
    findFirst: (args: unknown) => Promise<InterviewReportRow | null>;
  };
};

type InterviewReportRow = {
  id: string;
  status: string;
  candidate: { id: string; fullName: string };
  jobDescription: { id: string; title: string };
  scorecard: {
    recommendation: unknown;
    overallScore: number | null;
    summaryText: string | null;
    scorecardJson: unknown;
  } | null;
  questions: Array<{
    id: string;
    order: number;
    topic: string | null;
    difficulty: unknown;
    type: unknown;
    questionText: string;
    evaluation: { score: number | null; notesText: string | null; metadataJson: unknown } | null;
  }>;
};

export async function generateInterviewReportJson({
  interviewId,
  userId,
  organizationId,
}: {
  interviewId: string;
  userId: string;
  organizationId: string;
}): Promise<InterviewReport> {
  const db = prisma as unknown as Db;
  const interview = await db.interview.findFirst({
    where: { id: interviewId, organizationId },
    select: {
      id: true,
      status: true,
      candidate: { select: { id: true, fullName: true } },
      jobDescription: { select: { id: true, title: true } },
      scorecard: { select: { recommendation: true, overallScore: true, summaryText: true, scorecardJson: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          topic: true,
          difficulty: true,
          type: true,
          questionText: true,
          evaluation: { select: { score: true, notesText: true, metadataJson: true } },
        },
      },
    },
  });

  if (!interview) throw new Error("Interview not found.");

  return {
    kind: "interview",
    generatedAt: new Date().toISOString(),
    generatedByUserId: userId,
    version: "1",
    interview: {
      id: interview.id,
      status: String(interview.status),
      candidate: interview.candidate,
      jobDescription: interview.jobDescription,
    },
    scorecard: interview.scorecard
      ? {
          recommendation: interview.scorecard.recommendation ? String(interview.scorecard.recommendation) : null,
          overallScore: interview.scorecard.overallScore,
          summaryText: interview.scorecard.summaryText,
          scorecardJson: interview.scorecard.scorecardJson,
        }
      : null,
    questions: interview.questions.map((q) => ({
      id: q.id,
      order: q.order,
      topic: q.topic,
      difficulty: String(q.difficulty),
      type: String(q.type),
      questionText: q.questionText,
      evaluation: q.evaluation ? q.evaluation : null,
    })),
  };
}

export async function exportReport(_report: unknown, format: ReportFormat): Promise<string> {
  if (format === "json") return JSON.stringify(_report, null, 2);
  if (format === "csv") throw new Error("CSV export is not implemented yet.");
  if (format === "pdf") throw new Error("PDF export is not implemented yet.");
  return JSON.stringify(_report, null, 2);
}
