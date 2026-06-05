import { prisma } from "@/lib/prisma";
import type { InterviewReport, ReportFormat } from "@/lib/reports/types";
import type { ReportType } from "@prisma/client";

type Db = {
  interview: {
    findFirst: (args: unknown) => Promise<InterviewReportRow | null>;
  };
  user: {
    findFirst: (args: unknown) => Promise<{ id: string; name: string | null; email: string | null } | null>;
  };
  organizationMember: {
    findFirst: (args: unknown) => Promise<{ role: unknown } | null>;
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
  jobDescription: {
    id: string;
    title: string;
    department: string | null;
    location: string | null;
    seniorityLevel: unknown | null;
    descriptionText: string | null;
    requirementsText: string | null;
    parsedJdJson: unknown | null;
  };
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

function isCleanSummary(value: unknown): { ok: true } | { ok: false; reason: string } {
  if (typeof value !== "string") return { ok: false, reason: "not-a-string" };
  const text = value.trim();
  if (text.length < 20) return { ok: false, reason: "too-short" };

  const lower = text.toLowerCase();
  const has = (needle: string) => lower.includes(needle.toLowerCase());

  if (has("%pdf")) return { ok: false, reason: "pdf-header" };
  if (/\bobj\b/i.test(text)) return { ok: false, reason: "pdf-obj" };
  if (/\bendobj\b/i.test(text)) return { ok: false, reason: "pdf-endobj" };
  if (has("xref")) return { ok: false, reason: "pdf-xref" };
  if (has("trailer")) return { ok: false, reason: "pdf-trailer" };
  if (has("/creator") || has("creator")) return { ok: false, reason: "pdf-creator" };
  if (has("/producer") || has("producer")) return { ok: false, reason: "pdf-producer" };
  if (has("/creationdate") || has("creationdate")) return { ok: false, reason: "pdf-creationdate" };
  if (has("headlesschrome")) return { ok: false, reason: "headlesschrome" };

  if (has("mock ai summary") || has("(mock)") || /\bmock\b/i.test(text)) return { ok: false, reason: "mock" };
  if (has("summarize this resume")) return { ok: false, reason: "prompt-text" };
  if (has("pdf text extraction")) return { ok: false, reason: "parser-text" };
  if (has("raw extracted")) return { ok: false, reason: "raw-extracted" };

  const pdfDictTokens = (text.match(/<<|>>|\/type\b|\/pages\b|\/catalog\b|\/xobject\b|\/font\b/gi) ?? []).length;
  if (pdfDictTokens >= 2) return { ok: false, reason: "pdf-dict-tokens" };

  const pdfNameTokens = (text.match(/\/[A-Za-z]{2,}/g) ?? []).length;
  if (pdfNameTokens >= 4) return { ok: false, reason: "pdf-name-tokens" };

  const symbolCount = (text.match(/[<>/%]/g) ?? []).length;
  if (symbolCount >= 10 && symbolCount / text.length > 0.02) return { ok: false, reason: "pdf-symbol-ratio" };

  return { ok: true };
}

function isCleanJdSummary(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (text.length === 0) return false;

  const lower = text.toLowerCase();
  const has = (needle: string) => lower.includes(needle.toLowerCase());

  if (has("%pdf")) return false;
  if (/\bobj\b/i.test(text)) return false;
  if (/\bendobj\b/i.test(text)) return false;
  if (has("xref")) return false;
  if (has("trailer")) return false;
  if (has("/creator") || has("creator")) return false;
  if (has("/producer") || has("producer")) return false;
  if (has("/creationdate") || has("creationdate")) return false;
  if (has("headlesschrome")) return false;

  if (has("mock") || has("lorem ipsum")) return false;
  if (has("the text indicates")) return false;
  if (has("summarize this")) return false;
  if (has("raw extracted")) return false;

  const pdfDictTokens = (text.match(/<<|>>|\/type\b|\/pages\b|\/catalog\b/gi) ?? []).length;
  if (pdfDictTokens >= 2) return false;

  return true;
}

function getCleanCandidateSummary(candidate: { parsedResumeJson: unknown | null }): {
  summary: string;
  source: "parsedResumeJson.summary" | "parsedResumeJson.resumeAnalysis.summary" | "parsedResumeJson.analysis.summary" | "fallback";
  accepted: boolean;
  rejectedReason: string | null;
} {
  const parsed = candidate.parsedResumeJson as
    | null
    | {
        summary?: unknown;
        resumeAnalysis?: { summary?: unknown } | null;
        analysis?: { summary?: unknown } | null;
      };

  const candidates: Array<{ source: "parsedResumeJson.summary" | "parsedResumeJson.resumeAnalysis.summary" | "parsedResumeJson.analysis.summary"; value: unknown }> = [
    { source: "parsedResumeJson.summary", value: parsed?.summary },
    { source: "parsedResumeJson.resumeAnalysis.summary", value: parsed?.resumeAnalysis?.summary },
    { source: "parsedResumeJson.analysis.summary", value: parsed?.analysis?.summary },
  ];

  for (const c of candidates) {
    const verdict = isCleanSummary(c.value);
    if (verdict.ok) {
      return {
        summary: String(c.value).trim(),
        source: c.source,
        accepted: true,
        rejectedReason: null,
      };
    }
  }

  return {
    summary: "No clean resume summary available.",
    source: "fallback",
    accepted: false,
    rejectedReason: isCleanSummary(parsed?.summary).ok ? null : "no-clean-summary",
  };
}

function buildJobDescriptionSummary(input: {
  title: string;
  department?: string | null;
  seniorityLevel?: string | null;
  location?: string | null;
  descriptionText: string | null;
  requirementsText: string | null;
  parsedJdJson: unknown | null;
}): string {
  const parsed = input.parsedJdJson as
    | null
    | {
        requirements?: unknown;
        responsibilities?: unknown;
      };

  const reqList =
    Array.isArray(parsed?.requirements) ? parsed?.requirements : null;
  const respList =
    Array.isArray(parsed?.responsibilities) ? parsed?.responsibilities : null;

  const requirements = uniqueStrings([
    ...linesToItems(input.requirementsText),
    ...(reqList ? reqList.map((r) => safeString(r)).filter((v): v is string => Boolean(v)) : []),
  ]).slice(0, 8);

  const responsibilities = uniqueStrings([
    ...linesToItems(input.descriptionText),
    ...(respList ? respList.map((r) => safeString(r)).filter((v): v is string => Boolean(v)) : []),
  ]).slice(0, 8);

  const roleLine = `Role: ${input.title.trim()}`;
  const deptLine = input.department ? `Department: ${input.department}` : null;
  const seniorityLine = input.seniorityLevel ? `Seniority: ${input.seniorityLevel}` : null;
  const locationLine = input.location ? `Location: ${input.location}` : null;

  const reqBlock =
    requirements.length > 0 ? `\n\nKey requirements:\n${requirements.map((r) => `• ${r}`).join("\n")}` : "";
  const respBlock =
    responsibilities.length > 0 ? `\n\nResponsibilities:\n${responsibilities.map((r) => `• ${r}`).join("\n")}` : "";

  const header = [roleLine, deptLine, seniorityLine, locationLine].filter(Boolean).join("\n");
  const built = `${header}${reqBlock}${respBlock}`.trim();

  const safeFallback = "No structured job description summary available.";
  if (!built || built === `Role: ${input.title.trim()}`) return safeFallback;
  if (!isCleanJdSummary(built)) return safeFallback;
  return built;
}

function ensureCleanSummaryForPersistence(value: unknown, fallback: string): string {
  const verdict = isCleanSummary(value);
  if (verdict.ok) return String(value).trim();
  return fallback;
}

function ensureCleanJdSummaryForPersistence(value: unknown, fallback: string): string {
  if (isCleanJdSummary(value)) return String(value).trim();
  return fallback;
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
      jobDescription: {
        select: {
          id: true,
          title: true,
          department: true,
          location: true,
          seniorityLevel: true,
          descriptionText: true,
          requirementsText: true,
          parsedJdJson: true,
        },
      },
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

  const candidateSummaryMeta = getCleanCandidateSummary(interview.candidate);
  const jobDescriptionSummary = buildJobDescriptionSummary({
    title: interview.jobDescription.title,
    department: interview.jobDescription.department,
    location: interview.jobDescription.location,
    seniorityLevel: interview.jobDescription.seniorityLevel ? String(interview.jobDescription.seniorityLevel) : null,
    descriptionText: interview.jobDescription.descriptionText,
    requirementsText: interview.jobDescription.requirementsText,
    parsedJdJson: interview.jobDescription.parsedJdJson,
  });

  const generatedByUser = await db.user.findFirst({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  const generatedByMember = await db.organizationMember.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  const generatedByName =
    (generatedByUser?.name && generatedByUser.name.trim().length > 0 ? generatedByUser.name.trim() : null) ??
    (generatedByUser?.email && generatedByUser.email.trim().length > 0 ? generatedByUser.email.trim() : null) ??
    "Unknown User";
  const generatedByRole = generatedByMember?.role ? String(generatedByMember.role) : "UNKNOWN";

  return {
    kind: "interview",
    generatedAt: new Date().toISOString(),
    generatedByUserId: userId,
    version: "3",
    interview: {
      id: interview.id,
      status: String(interview.status),
      candidate: { id: interview.candidate.id, fullName: interview.candidate.fullName },
      jobDescription: { id: interview.jobDescription.id, title: interview.jobDescription.title },
    },
    generatedBy: {
      userId,
      name: generatedByName,
      role: generatedByRole,
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
    candidateSummary: candidateSummaryMeta.summary,
    jobDescriptionSummary,
    details: {
      candidateSummary: candidateSummaryMeta.summary,
      jobDescriptionSummary,
      strengths,
      weaknesses,
      interviewerStrongAreas: safeString(scorecardJson?.strongAreas),
      interviewerConcerns: safeString(scorecardJson?.hiringConcerns),
      interviewerFinalNotes: safeString(scorecardJson?.finalRecommendation) ?? interview.notesText,
      sourceHints: {
        resumeParsed: Boolean(safeString((interview.candidate.parsedResumeJson as { summary?: unknown } | null)?.summary)),
        jdParsed: Boolean(safeString((interview.jobDescription.parsedJdJson as { summary?: unknown } | null)?.summary)),
        aiSummaryApplied: typeof scorecardJson?.aiSummaryApplied === "boolean" ? scorecardJson.aiSummaryApplied : undefined,
        candidateSummarySource: candidateSummaryMeta.source,
        candidateSummaryAccepted: candidateSummaryMeta.accepted,
        candidateSummaryRejectedReason: candidateSummaryMeta.rejectedReason,
      },
      evaluationBreakdown: breakdown ?? undefined,
    },
  } as unknown as InterviewReport;
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
  const debug = process.env.REPORT_GENERATION_DEBUG === "1" || process.env.NODE_ENV !== "production";
  const cleanCandidateSummary = ensureCleanSummaryForPersistence(
    (payload as unknown as { candidateSummary?: unknown }).candidateSummary ?? payload.details?.candidateSummary ?? null,
    "No clean resume summary available.",
  );
  const cleanJobDescriptionSummary = ensureCleanJdSummaryForPersistence(
    (payload as unknown as { jobDescriptionSummary?: unknown }).jobDescriptionSummary ?? payload.details?.jobDescriptionSummary ?? null,
    "No clean job description summary available.",
  );
  (payload as unknown as { candidateSummary?: string }).candidateSummary = cleanCandidateSummary;
  (payload as unknown as { jobDescriptionSummary?: string }).jobDescriptionSummary = cleanJobDescriptionSummary;
  if (payload.details) {
    payload.details.candidateSummary = cleanCandidateSummary;
    payload.details.jobDescriptionSummary = cleanJobDescriptionSummary;
  }

  if (debug) {
    const hints = (payload.details?.sourceHints ?? {}) as Record<string, unknown>;
    const summarySource = typeof hints.candidateSummarySource === "string" ? hints.candidateSummarySource : "unknown";
    const summaryAccepted = typeof hints.candidateSummaryAccepted === "boolean" ? hints.candidateSummaryAccepted : null;
    const rejectedReason = typeof hints.candidateSummaryRejectedReason === "string" ? hints.candidateSummaryRejectedReason : null;
    console.info(
      `[report-generation] interviewId=${interviewId} candidateId=${payload.interview.candidate.id} summarySource=${summarySource} summaryAccepted=${String(
        summaryAccepted,
      )} rejectedReason=${rejectedReason ?? ""}`,
    );
  }

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
    if (debug) console.info(`[report-generation] reportId=${updated.id} action=update`);
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
  if (debug) console.info(`[report-generation] reportId=${created.id} action=create`);
  return { id: created.id };
}
