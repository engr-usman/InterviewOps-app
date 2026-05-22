"use server";

import { revalidatePath } from "next/cache";
import { Recommendation } from "@prisma/client";
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

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

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

function computeOverallScore({
  technicalAverage,
  communicationScore,
  problemSolvingScore,
  cloudDevOpsScore,
}: {
  technicalAverage: number | null;
  communicationScore?: number;
  problemSolvingScore?: number;
  cloudDevOpsScore?: number;
}): number | null {
  const parts: number[] = [];
  if (typeof technicalAverage === "number") parts.push(technicalAverage);
  if (typeof communicationScore === "number") parts.push(communicationScore);
  if (typeof problemSolvingScore === "number") parts.push(problemSolvingScore);
  if (typeof cloudDevOpsScore === "number") parts.push(cloudDevOpsScore);
  if (parts.length === 0) return null;
  const sum = parts.reduce((a, b) => a + b, 0);
  return Math.round((sum / parts.length) * 100) / 100;
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
    if (error instanceof Error) return { ok: false, error: error.message };
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
  if (!parsed.success) return { ok: false, error: "Invalid scorecard inputs." };

  const values: SaveScorecardValues = parsed.data;

  const communicationScore = nanToUndefined(values.communicationScore);
  const problemSolvingScore = nanToUndefined(values.problemSolvingScore);
  const cloudDevOpsScore = nanToUndefined(values.cloudDevOpsScore);

  const interviewSummary = values.interviewSummary?.trim() ? values.interviewSummary.trim() : "";
  const finalRecommendation = values.finalRecommendation?.trim() ? values.finalRecommendation.trim() : "";
  const hiringConcerns = values.hiringConcerns?.trim() ? values.hiringConcerns.trim() : "";
  const strongAreas = values.strongAreas?.trim() ? values.strongAreas.trim() : "";

  const recommendationRaw = (values as unknown as { recommendation?: Recommendation | "" }).recommendation;
  const recommendation = recommendationRaw ? recommendationRaw : null;

  try {
    const saved = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const db = tx as unknown as TxDb;
      const interview = await db.interview.findFirst({
        where: { id: interviewId, organizationId: ctx.organization.id },
        select: {
          id: true,
          questions: {
            select: { evaluation: { select: { score: true } } },
          },
        },
      });
      if (!interview) throw new Error("Interview not found.");

      const technicalAverage = computeTechnicalAverage(interview.questions);
      const overallScore = computeOverallScore({
        technicalAverage,
        communicationScore,
        problemSolvingScore,
        cloudDevOpsScore,
      });

      const scorecardJson = {
        technicalAverage,
        communicationScore,
        problemSolvingScore,
        cloudDevOpsScore,
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
        },
        update: {
          recommendation,
          overallScore,
          summaryText: interviewSummary ? interviewSummary : null,
          scorecardJson: scorecardJson as never,
        },
        select: { id: true },
      });
    });

    revalidatePath(`/interviews/${interviewId}/session`);
    revalidatePath(`/interviews/${interviewId}`);
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message };
    return { ok: false, error: "Failed to save scorecard." };
  }
}
