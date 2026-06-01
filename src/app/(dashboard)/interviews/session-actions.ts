"use server";

import { revalidatePath } from "next/cache";
import { DifficultyLevel, QuestionType, Recommendation } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/services/access";
import {
  saveQuestionEvaluationSchema,
  saveScorecardSchema,
  type EvaluationStatus,
  type SaveQuestionEvaluationValues,
  type SaveScorecardValues,
} from "@/features/interviews/interview-evaluation-schema";
import { addAdHocQuestionSchema, type AddAdHocQuestionValues } from "@/features/interviews/interview-question-schema";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

type TxDb = {
  interviewQuestion: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  interview: {
    findFirst: (args: unknown) => Promise<{ id: string; questions: Array<{ evaluation: { score: number | null } | null }> } | null>;
  };
};

function nanToUndefined(value: number | undefined): number | undefined {
  if (typeof value !== "number") return undefined;
  return Number.isNaN(value) ? undefined : value;
}

function computeTechnicalAverage(questions: Array<{ evaluation: { score: number | null } | null }>): number | null {
  const scores = questions.map((q) => q.evaluation?.score).filter((v): v is number => typeof v === "number");
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeOverallScore({
  technicalAverage,
  communicationScore,
  problemSolvingScore,
  interviewerTechnicalAssessment,
}: {
  technicalAverage: number | null;
  communicationScore?: number;
  problemSolvingScore?: number;
  interviewerTechnicalAssessment?: number;
}): number | null {
  if (typeof technicalAverage !== "number") return null;
  if (typeof communicationScore !== "number") return null;
  if (typeof problemSolvingScore !== "number") return null;
  if (typeof interviewerTechnicalAssessment !== "number") return null;

  const overall =
    technicalAverage * 0.5 +
    communicationScore * 0.15 +
    problemSolvingScore * 0.2 +
    interviewerTechnicalAssessment * 0.15;
  return round2(overall);
}

function computeAutoRecommendation(overallScore: number | null): Recommendation | null {
  if (typeof overallScore !== "number") return null;
  if (overallScore >= 8.5) return Recommendation.STRONG_HIRE;
  if (overallScore >= 7.0) return Recommendation.HIRE;
  if (overallScore >= 6.0) return Recommendation.BORDERLINE;
  return Recommendation.NO_HIRE;
}

export async function saveInterviewQuestionEvaluationAction(
  interviewId: string,
  interviewQuestionId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "interview:conduct");
  const parsed = saveQuestionEvaluationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid evaluation inputs." };

  const values: SaveQuestionEvaluationValues = parsed.data;
  const score = nanToUndefined(values.score);
  const status: EvaluationStatus = values.status;
  const strengthsNotes = values.strengthsNotes?.trim() ? values.strengthsNotes.trim() : "";
  const weaknessesNotes = values.weaknessesNotes?.trim() ? values.weaknessesNotes.trim() : "";
  const overallNotes = values.overallNotes?.trim() ? values.overallNotes.trim() : "";

  try {
    const saved = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const db = tx as unknown as TxDb;
      const interview = await tx.interview.findFirst({
        where: { id: interviewId, organizationId: ctx.organization.id },
        select: { status: true },
      });
      if (!interview) throw new Error("Interview not found.");
      if (interview.status === "COMPLETED") {
        const e = new Error("Interview is completed and cannot be modified.");
        (e as unknown as { status?: number }).status = 409;
        throw e;
      }

      const question = await db.interviewQuestion.findFirst({
        where: {
          id: interviewQuestionId,
          interviewId,
          interview: { organizationId: ctx.organization.id },
        },
        select: { id: true },
      });
      if (!question) throw new Error("Question not found.");

      return tx.interviewQuestionEvaluation.upsert({
        where: { interviewQuestionId },
        create: {
          interviewQuestionId,
          score: typeof score === "number" ? score : null,
          notesText: overallNotes ? overallNotes : null,
          metadataJson: { status, strengthsNotes, weaknessesNotes } as never,
        },
        update: {
          score: typeof score === "number" ? score : null,
          notesText: overallNotes ? overallNotes : null,
          metadataJson: { status, strengthsNotes, weaknessesNotes } as never,
        },
        select: { id: true },
      });
    });

    revalidatePath(`/interviews/${interviewId}/session`);
    revalidatePath(`/interviews/${interviewId}`);
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as unknown as { status?: number }).status;
      return { ok: false, error: error.message, status };
    }
    return { ok: false, error: "Failed to save evaluation." };
  }
}

export async function saveInterviewScorecardAction(
  interviewId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "interview:conduct");
  const parsed = saveScorecardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Communication, problem solving, and interviewer technical assessment are required (1–10).",
    };
  }

  const values: SaveScorecardValues = parsed.data;

  const communicationScore = nanToUndefined(values.communicationScore);
  const problemSolvingScore = nanToUndefined(values.problemSolvingScore);
  const interviewerTechnicalAssessment = nanToUndefined(values.interviewerTechnicalAssessment);

  const interviewSummary = values.interviewSummary?.trim() ? values.interviewSummary.trim() : "";
  const finalRecommendation = values.finalRecommendation?.trim() ? values.finalRecommendation.trim() : "";
  const hiringConcerns = values.hiringConcerns?.trim() ? values.hiringConcerns.trim() : "";
  const strongAreas = values.strongAreas?.trim() ? values.strongAreas.trim() : "";

  try {
    const saved = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const db = tx as unknown as TxDb;
      const interview = await db.interview.findFirst({
        where: { id: interviewId, organizationId: ctx.organization.id },
        select: {
          id: true,
          status: true,
          questions: {
            select: { evaluation: { select: { score: true } } },
          },
        },
      });
      if (!interview) throw new Error("Interview not found.");
      if ((interview as unknown as { status?: unknown }).status === "COMPLETED") {
        const e = new Error("Interview is completed and cannot be modified.");
        (e as unknown as { status?: number }).status = 409;
        throw e;
      }

      const technicalAverage = computeTechnicalAverage(interview.questions);
      if (typeof technicalAverage !== "number") {
        throw new Error("Evaluate at least one question to compute the technical average.");
      }
      const overallScore = computeOverallScore({
        technicalAverage,
        communicationScore,
        problemSolvingScore,
        interviewerTechnicalAssessment,
      });
      if (typeof overallScore !== "number") {
        throw new Error("Overall score could not be calculated. Please check your scorecard inputs.");
      }
      const autoRecommendation = computeAutoRecommendation(overallScore);
      const recommendation = autoRecommendation ?? Recommendation.NO_HIRE;

      const scorecardJson = {
        technicalAverage,
        communicationScore,
        problemSolvingScore,
        interviewerTechnicalAssessment,
        overallScore,
        finalRecommendation,
        hiringConcerns,
        strongAreas,
      };

      return tx.evaluationScorecard.upsert({
        where: { interviewId },
        create: {
          interviewId,
          recommendation,
          overallScore,
          summaryText: interviewSummary ? interviewSummary : null,
          scorecardJson: scorecardJson as never,
          metadataJson: {
            scoringModel: "weighted_v2",
            autoRecommendation,
            manualOverride: false,
          } as never,
        },
        update: {
          recommendation,
          overallScore,
          summaryText: interviewSummary ? interviewSummary : null,
          scorecardJson: scorecardJson as never,
          metadataJson: {
            scoringModel: "weighted_v2",
            autoRecommendation,
            manualOverride: false,
          } as never,
        },
        select: { id: true },
      });
    });

    revalidatePath(`/interviews/${interviewId}/session`);
    revalidatePath(`/interviews/${interviewId}`);
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    if (error instanceof Error) {
      const status = (error as unknown as { status?: number }).status;
      return { ok: false, error: error.message, status };
    }
    return { ok: false, error: "Failed to save scorecard." };
  }
}

export async function addAdHocInterviewQuestionAction(
  interviewId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "interview:conduct");
  const parsed = addAdHocQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid question inputs." };

  const values: AddAdHocQuestionValues = parsed.data;
  const rawTopic = (values as { topic?: unknown }).topic;
  const rawDifficulty = (values as { difficulty?: unknown }).difficulty;
  const topic = typeof rawTopic === "string" && rawTopic !== "" ? rawTopic.trim() : null;
  const difficulty =
    typeof rawDifficulty === "string" && rawDifficulty !== "" ? (rawDifficulty as DifficultyLevel) : null;

  try {
    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const interview = await tx.interview.findFirst({
        where: { id: interviewId, organizationId: ctx.organization.id },
        select: { id: true, status: true },
      });
      if (!interview) throw new Error("Interview not found.");
      if (interview.status === "COMPLETED") {
        const e = new Error("Interview is completed and cannot be modified.");
        (e as unknown as { status?: number }).status = 409;
        throw e;
      }

      const maxOrderAgg = await tx.interviewQuestion.aggregate({
        where: { interviewId },
        _max: { order: true },
      });
      const nextOrder = (maxOrderAgg._max.order ?? 0) + 1;

      return tx.interviewQuestion.create({
        data: {
          interviewId,
          order: nextOrder,
          topic,
          questionText: values.questionText.trim(),
          type: QuestionType.FOLLOW_UP,
          difficulty: difficulty ?? DifficultyLevel.MID_LEVEL,
        },
        select: { id: true },
      });
    });

    revalidatePath(`/interviews/${interviewId}/session`);
    revalidatePath(`/interviews/${interviewId}`);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message };
    return { ok: false, error: "Failed to add question." };
  }
}

export async function completeInterviewAction(interviewId: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "interview:conduct");

  try {
    const updatedWithEndedAt = await prisma.interview.updateMany({
      where: {
        id: interviewId,
        organizationId: ctx.organization.id,
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        endedAt: null,
      },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
      },
    });

    const updated = updatedWithEndedAt.count
      ? updatedWithEndedAt
      : await prisma.interview.updateMany({
          where: {
            id: interviewId,
            organizationId: ctx.organization.id,
            status: { notIn: ["CANCELLED", "COMPLETED"] },
          },
          data: { status: "COMPLETED" },
        });

    if (updated.count === 0) return { ok: false, error: "Interview not found." };

    revalidatePath(`/interviews/${interviewId}/session`);
    revalidatePath(`/interviews/${interviewId}`);
    revalidatePath("/interviews");
    return { ok: true, data: { id: interviewId } };
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message };
    return { ok: false, error: "Failed to complete interview." };
  }
}
