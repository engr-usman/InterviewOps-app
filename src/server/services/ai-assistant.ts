import { DifficultyLevel, QuestionType, Recommendation } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/ai/json";
import { buildAiQuestionGenerationPrompt, type AiQuestionStyle } from "@/lib/ai/prompts/ai-question-generation.prompt";
import { buildEvaluationInsightPrompt } from "@/lib/ai/prompts/evaluation-insight.prompt";
import { buildFollowUpPrompt } from "@/lib/ai/prompts/follow-up.prompt";
import { buildInterviewSummaryPrompt } from "@/lib/ai/prompts/interview-summary.prompt";
import { buildJdAnalysisPrompt } from "@/lib/ai/prompts/jd-analysis.prompt";
import { buildResumeAnalysisPrompt } from "@/lib/ai/prompts/resume-analysis.prompt";
import { getAiProviderOrThrow } from "@/server/services/ai-runtime";
import { getBooleanSetting } from "@/server/services/app-settings";

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((t) => typeof t === "string").slice(0, 12) as string[];
}

export async function generateCandidateAiAnalysis(candidateId: string, userId: string) {
  const aiEnabled = await getBooleanSetting("ai.enabled", false);
  if (!aiEnabled) throw new Error("AI features are disabled.");

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, createdById: userId },
    select: {
      id: true,
      fullName: true,
      seniorityLevel: true,
      parsedResumeJson: true,
    },
  });
  if (!candidate) throw new Error("Candidate not found.");

  const ai = await getAiProviderOrThrow();
  const parsedResume = candidate.parsedResumeJson as { rawTextPreview?: unknown } | null;
  const resumeTextPreview = typeof parsedResume?.rawTextPreview === "string" ? parsedResume.rawTextPreview : null;

  const { system, prompt } = buildResumeAnalysisPrompt({
    candidateName: candidate.fullName,
    candidateSeniorityLevel: candidate.seniorityLevel ?? null,
    parsedResumeJson: candidate.parsedResumeJson,
    resumeTextPreview,
  });

  const resp = await ai.generateText({ system, prompt });
  const json = safeJsonParse<Record<string, unknown>>(resp.text);
  if (!json) throw new Error("Invalid AI response.");

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      aiMetadataJson: {
        ...(typeof candidate === "object" ? {} : {}),
        resumeAnalysis: json,
        provider: resp.provider,
        model: resp.model,
        generatedAt: new Date().toISOString(),
      } as never,
    },
    select: { id: true },
  });
}

export async function generateJobDescriptionAiAnalysis(jobDescriptionId: string, userId: string) {
  const aiEnabled = await getBooleanSetting("ai.enabled", false);
  if (!aiEnabled) throw new Error("AI features are disabled.");

  const jd = await prisma.jobDescription.findFirst({
    where: { id: jobDescriptionId, createdById: userId },
    select: {
      id: true,
      title: true,
      seniorityLevel: true,
      descriptionText: true,
      requirementsText: true,
      parsedJdJson: true,
    },
  });
  if (!jd) throw new Error("Job description not found.");

  const ai = await getAiProviderOrThrow();
  const { system, prompt } = buildJdAnalysisPrompt({
    title: jd.title,
    seniorityLevel: jd.seniorityLevel ?? null,
    descriptionText: jd.descriptionText ?? null,
    requirementsText: jd.requirementsText ?? null,
    parsedJdJson: jd.parsedJdJson,
  });

  const resp = await ai.generateText({ system, prompt });
  const json = safeJsonParse<Record<string, unknown>>(resp.text);
  if (!json) throw new Error("Invalid AI response.");

  await prisma.jobDescription.update({
    where: { id: jobDescriptionId },
    data: {
      aiMetadataJson: {
        jdAnalysis: json,
        provider: resp.provider,
        model: resp.model,
        generatedAt: new Date().toISOString(),
      } as never,
    },
    select: { id: true },
  });
}

export type GenerateAiQuestionsInput = {
  count: number;
  focusArea?: string;
  difficulty?: DifficultyLevel;
  seniority?: string;
  style?: AiQuestionStyle;
};

export async function generateAiInterviewQuestions(interviewId: string, userId: string, input: GenerateAiQuestionsInput) {
  const aiEnabled = await getBooleanSetting("ai.enabled", false);
  if (!aiEnabled) throw new Error("AI features are disabled.");
  const aiQuestionsEnabled = await getBooleanSetting("ai.questions.enabled", false);
  if (!aiQuestionsEnabled) throw new Error("AI-generated questions are disabled.");

  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, createdById: userId },
    select: {
      id: true,
      candidate: { select: { fullName: true, parsedResumeJson: true } },
      jobDescription: { select: { title: true, parsedJdJson: true, seniorityLevel: true } },
      questions: { select: { questionText: true, topic: true }, orderBy: { order: "asc" } },
    },
  });
  if (!interview) throw new Error("Interview not found.");

  const questionBankExamples = await prisma.questionBank.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { topic: true, prompt: true, difficulty: true },
  });

  const ai = await getAiProviderOrThrow();
  const { system, prompt } = buildAiQuestionGenerationPrompt({
    count: input.count,
    focusArea: input.focusArea ?? null,
    difficulty: input.difficulty ?? null,
    seniority: input.seniority ?? interview.jobDescription.seniorityLevel ?? null,
    style: input.style ?? null,
    candidateName: interview.candidate.fullName,
    candidateParsedResume: interview.candidate.parsedResumeJson,
    jobDescriptionTitle: interview.jobDescription.title,
    jobDescriptionParsed: interview.jobDescription.parsedJdJson,
    existingInterviewQuestions: interview.questions.map((q) => ({ topic: q.topic, questionText: q.questionText })),
    questionBankExamples: questionBankExamples.map((q) => ({ topic: q.topic, prompt: q.prompt, difficulty: q.difficulty })),
  });

  const resp = await ai.generateText({ system, prompt });
  const json = safeJsonParse<{ questions?: Array<{ topic?: unknown; difficulty?: unknown; questionText?: unknown; tags?: unknown }> }>(
    resp.text,
  );
  const candidateQuestions = json?.questions ?? [];
  const cleaned = candidateQuestions
    .map((q) => ({
      topic: typeof q.topic === "string" ? q.topic : "AI",
      difficulty: typeof q.difficulty === "string" ? q.difficulty : null,
      questionText: typeof q.questionText === "string" ? q.questionText.trim() : "",
      tags: normalizeTags(q.tags),
    }))
    .filter((q) => q.questionText.length >= 10)
    .slice(0, input.count);

  if (cleaned.length === 0) throw new Error("AI did not return any questions.");

  const existingText = new Set(interview.questions.map((q) => q.questionText.trim().toLowerCase()));

  const toCreate = cleaned.filter((q) => !existingText.has(q.questionText.toLowerCase()));

  const createdCount = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const maxOrderAgg = await tx.interviewQuestion.aggregate({
      where: { interviewId },
      _max: { order: true },
    });
    const startOrder = (maxOrderAgg._max.order ?? 0) + 1;

    await tx.interviewQuestion.createMany({
      data: toCreate.map((q, idx) => ({
        interviewId,
        questionBankId: null,
        order: startOrder + idx,
        topic: q.topic,
        questionText: q.questionText,
        type: QuestionType.AI_GENERATED,
        difficulty:
          q.difficulty === "BEGINNER" ||
          q.difficulty === "JUNIOR" ||
          q.difficulty === "MID_LEVEL" ||
          q.difficulty === "SENIOR" ||
          q.difficulty === "LEAD" ||
          q.difficulty === "HEAD_ARCHITECT"
            ? (q.difficulty as DifficultyLevel)
            : (input.difficulty ?? DifficultyLevel.MID_LEVEL),
        tagsJson: q.tags.length > 0 ? (q.tags as unknown as Prisma.InputJsonValue) : undefined,
        aiMetadataJson: { provider: resp.provider, model: resp.model, generatedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue,
      })),
    });

    return toCreate.length;
  });

  return { createdCount };
}

export async function suggestFollowUpQuestions({
  interviewId,
  interviewQuestionId,
  userId,
}: {
  interviewId: string;
  interviewQuestionId: string;
  userId: string;
}) {
  const aiEnabled = await getBooleanSetting("ai.enabled", false);
  if (!aiEnabled) throw new Error("AI features are disabled.");

  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, createdById: userId },
    select: {
      id: true,
      candidate: { select: { parsedResumeJson: true } },
      jobDescription: { select: { parsedJdJson: true } },
      questions: {
        where: { id: interviewQuestionId },
        select: {
          id: true,
          topic: true,
          difficulty: true,
          questionText: true,
          evaluation: { select: { score: true, notesText: true, metadataJson: true } },
        },
      },
    },
  });
  if (!interview) throw new Error("Interview not found.");
  const q = interview.questions[0];
  if (!q) throw new Error("Question not found.");

  const meta = q.evaluation?.metadataJson as { strengthsNotes?: unknown; weaknessesNotes?: unknown } | null;
  const evaluationNotes = {
    strengthsNotes: typeof meta?.strengthsNotes === "string" ? meta.strengthsNotes : null,
    weaknessesNotes: typeof meta?.weaknessesNotes === "string" ? meta.weaknessesNotes : null,
    overallNotes: q.evaluation?.notesText ?? null,
    score: q.evaluation?.score ?? null,
  };

  const ai = await getAiProviderOrThrow();
  const { system, prompt } = buildFollowUpPrompt({
    currentQuestionText: q.questionText,
    currentTopic: q.topic,
    evaluationNotes,
    candidateParsedResume: interview.candidate.parsedResumeJson,
    jobDescriptionParsed: interview.jobDescription.parsedJdJson,
  });

  const resp = await ai.generateText({ system, prompt });
  const json = safeJsonParse<{ followUps?: Array<{ questionText?: unknown; intent?: unknown; tags?: unknown }> }>(resp.text);
  const followUps = (json?.followUps ?? [])
    .map((f) => ({
      questionText: typeof f.questionText === "string" ? f.questionText.trim() : "",
      intent: typeof f.intent === "string" ? f.intent.trim() : "",
      tags: normalizeTags(f.tags),
    }))
    .filter((f) => f.questionText.length > 0)
    .slice(0, 5);

  if (followUps.length === 0) throw new Error("AI did not return follow-up questions.");
  return { followUps, provider: resp.provider, model: resp.model };
}

export async function generateEvaluationInsight({
  interviewId,
  interviewQuestionId,
  userId,
}: {
  interviewId: string;
  interviewQuestionId: string;
  userId: string;
}) {
  const aiEnabled = await getBooleanSetting("ai.enabled", false);
  if (!aiEnabled) throw new Error("AI features are disabled.");
  const evalEnabled = await getBooleanSetting("ai.evaluation.enabled", false);
  if (!evalEnabled) throw new Error("AI evaluation suggestions are disabled.");

  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, createdById: userId },
    select: {
      id: true,
      candidate: { select: { parsedResumeJson: true } },
      jobDescription: { select: { parsedJdJson: true } },
      questions: {
        where: { id: interviewQuestionId },
        select: {
          id: true,
          topic: true,
          difficulty: true,
          questionText: true,
          evaluation: { select: { notesText: true, metadataJson: true } },
        },
      },
    },
  });
  if (!interview) throw new Error("Interview not found.");
  const q = interview.questions[0];
  if (!q) throw new Error("Question not found.");

  const meta = q.evaluation?.metadataJson as { strengthsNotes?: unknown; weaknessesNotes?: unknown } | null;
  const evaluationNotes = {
    strengthsNotes: typeof meta?.strengthsNotes === "string" ? meta.strengthsNotes : null,
    weaknessesNotes: typeof meta?.weaknessesNotes === "string" ? meta.weaknessesNotes : null,
    overallNotes: q.evaluation?.notesText ?? null,
  };

  const ai = await getAiProviderOrThrow();
  const { system, prompt } = buildEvaluationInsightPrompt({
    questionText: q.questionText,
    topic: q.topic,
    difficulty: q.difficulty,
    evaluationNotes,
    candidateParsedResume: interview.candidate.parsedResumeJson,
    jobDescriptionParsed: interview.jobDescription.parsedJdJson,
  });

  const resp = await ai.generateText({ system, prompt });
  const json = safeJsonParse<Record<string, unknown>>(resp.text);
  if (!json) throw new Error("Invalid AI response.");

  return { insight: json, provider: resp.provider, model: resp.model };
}

export async function generateInterviewSummary(interviewId: string, userId: string) {
  const aiEnabled = await getBooleanSetting("ai.enabled", false);
  if (!aiEnabled) throw new Error("AI features are disabled.");
  const evalEnabled = await getBooleanSetting("ai.evaluation.enabled", false);
  if (!evalEnabled) throw new Error("AI evaluation suggestions are disabled.");

  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, createdById: userId },
    select: {
      id: true,
      candidate: { select: { fullName: true } },
      jobDescription: { select: { title: true } },
      scorecard: { select: { recommendation: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          topic: true,
          questionText: true,
          evaluation: { select: { score: true } },
        },
      },
    },
  });
  if (!interview) throw new Error("Interview not found.");

  const scores = interview.questions.map((q) => q.evaluation?.score).filter((s): s is number => typeof s === "number");
  const technicalAverage = scores.length === 0 ? null : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;

  const ai = await getAiProviderOrThrow();
  const { system, prompt } = buildInterviewSummaryPrompt({
    candidateName: interview.candidate.fullName,
    jobTitle: interview.jobDescription.title,
    technicalAverage,
    recommendation: interview.scorecard?.recommendation ?? null,
    evaluatedQuestions: interview.questions.map((q) => ({
      topic: q.topic,
      questionText: q.questionText,
      score: q.evaluation?.score ?? null,
    })),
  });

  const resp = await ai.generateText({ system, prompt });
  const json = safeJsonParse<Record<string, unknown>>(resp.text);
  if (!json) throw new Error("Invalid AI response.");

  const suggestedRecommendation =
    typeof json.suggestedRecommendation === "string" &&
    (Object.values(Recommendation) as string[]).includes(json.suggestedRecommendation)
      ? (json.suggestedRecommendation as Recommendation)
      : null;

  return { summary: json, suggestedRecommendation, provider: resp.provider, model: resp.model };
}
