import { prisma } from "@/lib/prisma";
import type { InterviewReport, ReportFormat } from "@/lib/reports/types";
import type { ReportType } from "@prisma/client";

type Db = {
  interview: {
    findFirst: (args: unknown) => Promise<InterviewReportRow | null>;
  };
  report: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
    create: (args: unknown) => Promise<{ id: string }>;
    update: (args: unknown) => Promise<{ id: string }>;
  };
};

type InterviewReportRow = {
  id: string;
  status: string;
  notesText: string | null;
  candidate: { id: string; fullName: string; parsedResumeJson: unknown | null };
  jobDescription: { id: string; title: string; parsedJdJson: unknown | null };
  scorecard: {
    recommendation: unknown;
    overallScore: number | null;
    summaryText: string | null;
    scorecardJson: unknown;
    metadataJson: unknown;
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

function safeString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function extractSummaryFromParsedResume(parsedResumeJson: unknown | null): string | null {
  const json = parsedResumeJson as { summary?: unknown } | null;
  const s = safeString(json?.summary);
  return s && s.trim().length > 0 ? s.trim() : null;
}

function extractSummaryFromParsedJd(parsedJdJson: unknown | null): string | null {
  const json = parsedJdJson as { summary?: unknown } | null;
  const s = safeString(json?.summary);
  return s && s.trim().length > 0 ? s.trim() : null;
}

function linesToItems(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

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
      notesText: true,
      candidate: { select: { id: true, fullName: true, parsedResumeJson: true } },
      jobDescription: { select: { id: true, title: true, parsedJdJson: true } },
      scorecard: { select: { recommendation: true, overallScore: true, summaryText: true, scorecardJson: true, metadataJson: true } },
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

  const scorecardJson = (interview.scorecard?.scorecardJson ?? null) as
    | null
    | {
        strongAreas?: unknown;
        hiringConcerns?: unknown;
        finalRecommendation?: unknown;
        aiSummaryApplied?: unknown;
        technicalAverage?: unknown;
        communicationScore?: unknown;
        problemSolvingScore?: unknown;
        cloudDevOpsScore?: unknown;
        interviewerTechnicalAssessment?: unknown;
        overallScore?: unknown;
      };

  const strengthsFromScorecard = linesToItems(scorecardJson?.strongAreas);
  const weaknessesFromScorecard = linesToItems(scorecardJson?.hiringConcerns);

  const strengthsFromQuestions = interview.questions
    .map((q) => (q.evaluation?.metadataJson as { strengthsNotes?: unknown } | null)?.strengthsNotes)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, 20);
  const weaknessesFromQuestions = interview.questions
    .map((q) => (q.evaluation?.metadataJson as { weaknessesNotes?: unknown } | null)?.weaknessesNotes)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, 20);

  const strengths = uniqueStrings([...strengthsFromScorecard, ...strengthsFromQuestions]);
  const weaknesses = uniqueStrings([...weaknessesFromScorecard, ...weaknessesFromQuestions]);

  const scMeta = (interview.scorecard?.metadataJson ?? null) as { manualOverride?: unknown; autoRecommendation?: unknown } | null;
  const breakdown = interview.scorecard
    ? {
        technicalAverage: typeof scorecardJson?.technicalAverage === "number" ? scorecardJson.technicalAverage : null,
        communication: typeof scorecardJson?.communicationScore === "number" ? scorecardJson.communicationScore : null,
        problemSolving: typeof scorecardJson?.problemSolvingScore === "number" ? scorecardJson.problemSolvingScore : null,
        interviewerTechnicalAssessment:
          typeof scorecardJson?.interviewerTechnicalAssessment === "number"
            ? scorecardJson.interviewerTechnicalAssessment
            : typeof scorecardJson?.cloudDevOpsScore === "number"
              ? scorecardJson.cloudDevOpsScore
              : null,
        overallScore: interview.scorecard.overallScore ?? null,
        recommendation: interview.scorecard.recommendation ? String(interview.scorecard.recommendation) : null,
        autoRecommendation: typeof scMeta?.autoRecommendation === "string" ? scMeta.autoRecommendation : null,
        manualOverride: scMeta?.manualOverride === true,
      }
    : null;

  return {
    kind: "interview",
    generatedAt: new Date().toISOString(),
    generatedByUserId: userId,
    version: "3",
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
    details: {
      candidateSummary: extractSummaryFromParsedResume(interview.candidate.parsedResumeJson),
      jobDescriptionSummary: extractSummaryFromParsedJd(interview.jobDescription.parsedJdJson),
      strengths,
      weaknesses,
      interviewerStrongAreas: safeString(scorecardJson?.strongAreas),
      interviewerConcerns: safeString(scorecardJson?.hiringConcerns),
      interviewerFinalNotes: safeString(scorecardJson?.finalRecommendation) ?? interview.notesText,
      sourceHints: {
        resumeParsed: Boolean(extractSummaryFromParsedResume(interview.candidate.parsedResumeJson)),
        jdParsed: Boolean(extractSummaryFromParsedJd(interview.jobDescription.parsedJdJson)),
        aiSummaryApplied: typeof scorecardJson?.aiSummaryApplied === "boolean" ? scorecardJson.aiSummaryApplied : undefined,
      },
      evaluationBreakdown: breakdown ?? undefined,
    },
  };
}

export async function exportReport(_report: unknown, format: ReportFormat): Promise<string> {
  if (format === "json") return JSON.stringify(_report, null, 2);
  if (format === "csv") throw new Error("CSV export is not implemented yet.");
  if (format === "pdf") throw new Error("PDF export is not implemented yet.");
  return JSON.stringify(_report, null, 2);
}

export async function generateAndUpsertInterviewReport({
  interviewId,
  organizationId,
  userId,
  type,
  force,
}: {
  interviewId: string;
  organizationId: string;
  userId: string;
  type: ReportType;
  force: boolean;
}): Promise<{ id: string }> {
  const db = prisma as unknown as Db;
  const payload = await generateInterviewReportJson({ interviewId, organizationId, userId });

  const missingRequirements: string[] = [];
  if (payload.interview.status !== "COMPLETED") missingRequirements.push("status");
  if (payload.questions.length === 0) missingRequirements.push("questions");
  if (payload.questions.every((q) => !q.evaluation || typeof q.evaluation.score !== "number")) {
    missingRequirements.push("evaluations");
  }
  if (!payload.scorecard) missingRequirements.push("scorecard");
  if (missingRequirements.length > 0) {
    throw new Error(
      "Report can only be generated after the interview is completed with evaluated questions and a saved scorecard.",
    );
  }

  const title = `${payload.interview.candidate.fullName} — ${payload.interview.jobDescription.title} (${type})`;

  const warnings: string[] = [];
  if (!payload.scorecard) warnings.push("No scorecard saved yet. Report is partial.");
  if (payload.questions.length === 0) warnings.push("No interview questions found.");
  if (payload.questions.every((q) => !q.evaluation || typeof q.evaluation.score !== "number")) {
    warnings.push("No scored evaluations found yet.");
  }
  if (warnings.length > 0) {
    payload.details = {
      ...(payload.details ?? { strengths: [], weaknesses: [] }),
      sourceHints: {
        ...(payload.details?.sourceHints ?? {}),
      },
    };
    (payload as unknown as { warnings?: string[] }).warnings = warnings;
  }

  const existing = await db.report.findFirst({
    where: { organizationId, interviewId, type },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existing && !force) return { id: existing.id };

  if (existing && force) {
    const updated = await db.report.update({
      where: { id: existing.id },
      data: { title, reportJson: payload as never, organizationId },
      select: { id: true },
    });
    return { id: updated.id };
  }

  const created = await db.report.create({
    data: {
      interviewId,
      organizationId,
      type,
      title,
      reportJson: payload as never,
    },
    select: { id: true },
  });
  return { id: created.id };
}
