"use server";

import { revalidatePath } from "next/cache";
import type { Recommendation } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateAiQuestionsSchema, type GenerateAiQuestionsValues } from "@/features/ai/ai-interview-schemas";
import {
  generateCandidateAiAnalysis,
  generateEvaluationInsight,
  generateAiInterviewQuestions,
  generateInterviewSummary,
  generateJobDescriptionAiAnalysis,
  suggestFollowUpQuestions,
} from "@/server/services/ai-assistant";
import { hasFeature } from "@/server/services/feature-flags";
import { requireOrgPermission } from "@/server/services/access";
import { hasPermission } from "@/server/services/rbac";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type TxDb = {
  interview: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
};

export async function generateCandidateAiAnalysisAction(candidateId: string): Promise<ActionResult<{ ok: true }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };
  try {
    const ctx = await requireOrgPermission(session.user.id, "ai:use");
    const allowed = await hasFeature(ctx.organization.id, "ai");
    if (!allowed) return { ok: false, error: "This feature is not available on your plan." };

    await generateCandidateAiAnalysis(candidateId, ctx.organization.id);
    revalidatePath(`/candidates/${candidateId}`);
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to generate AI analysis." };
  }
}

export async function generateJobDescriptionAiAnalysisAction(
  jobDescriptionId: string,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };
  try {
    const ctx = await requireOrgPermission(session.user.id, "ai:use");
    const allowed = await hasFeature(ctx.organization.id, "ai");
    if (!allowed) return { ok: false, error: "This feature is not available on your plan." };

    await generateJobDescriptionAiAnalysis(jobDescriptionId, ctx.organization.id);
    revalidatePath(`/job-descriptions/${jobDescriptionId}`);
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to generate AI analysis." };
  }
}

export async function generateAiInterviewQuestionsAction(
  interviewId: string,
  input: unknown,
): Promise<ActionResult<{ createdCount: number }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const parsed = generateAiQuestionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid inputs." };

  const values: GenerateAiQuestionsValues = parsed.data;

  try {
    const ctx = await requireOrgPermission(session.user.id, "interview:manage");
    if (!hasPermission(ctx.role, "ai:use")) return { ok: false, error: "Insufficient permissions." };
    const allowed = await hasFeature(ctx.organization.id, "ai");
    if (!allowed) return { ok: false, error: "This feature is not available on your plan." };

    const focusAreaRaw = (values as unknown as { focusArea?: unknown }).focusArea;
    const difficultyRaw = (values as unknown as { difficulty?: unknown }).difficulty;
    const seniorityRaw = (values as unknown as { seniority?: unknown }).seniority;
    const styleRaw = (values as unknown as { style?: unknown }).style;

    const result = await generateAiInterviewQuestions(interviewId, ctx.organization.id, {
      count: values.count,
      focusArea: typeof focusAreaRaw === "string" && focusAreaRaw.trim() !== "" ? focusAreaRaw.trim() : undefined,
      difficulty: typeof difficultyRaw === "string" && difficultyRaw !== "" ? (difficultyRaw as never) : undefined,
      seniority: typeof seniorityRaw === "string" && seniorityRaw !== "" ? seniorityRaw : undefined,
      style: typeof styleRaw === "string" && styleRaw !== "" ? (styleRaw as never) : undefined,
    });
    revalidatePath(`/interviews/${interviewId}`);
    return { ok: true, data: { createdCount: result.createdCount } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to generate AI questions." };
  }
}

export async function suggestFollowUpQuestionsAction(
  interviewId: string,
  interviewQuestionId: string,
): Promise<ActionResult<{ followUps: Array<{ questionText: string; intent: string; tags: string[] }> }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  try {
    const ctx = await requireOrgPermission(session.user.id, "interview:conduct");
    if (!hasPermission(ctx.role, "ai:use")) return { ok: false, error: "Insufficient permissions." };
    const allowed = await hasFeature(ctx.organization.id, "ai");
    if (!allowed) return { ok: false, error: "This feature is not available on your plan." };

    const result = await suggestFollowUpQuestions({
      interviewId,
      interviewQuestionId,
      organizationId: ctx.organization.id,
    });
    return { ok: true, data: { followUps: result.followUps } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to generate follow-ups." };
  }
}

export async function acceptFollowUpQuestionAction(
  interviewId: string,
  questionText: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const text = questionText.trim();
  if (text.length < 5) return { ok: false, error: "Invalid follow-up question." };

  try {
    const ctx = await requireOrgPermission(session.user.id, "interview:conduct");
    if (!hasPermission(ctx.role, "ai:use")) return { ok: false, error: "Insufficient permissions." };
    const allowed = await hasFeature(ctx.organization.id, "ai");
    if (!allowed) return { ok: false, error: "This feature is not available on your plan." };

    const created = await prisma.$transaction(async (tx) => {
      const db = tx as unknown as TxDb;
      const interview = await db.interview.findFirst({
        where: { id: interviewId, organizationId: ctx.organization.id },
        select: { id: true },
      });
      if (!interview) throw new Error("Interview not found.");

      const existing = await tx.interviewQuestion.findFirst({
        where: { interviewId, questionText: { equals: text, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) throw new Error("This question already exists in the interview.");

      const maxOrderAgg = await tx.interviewQuestion.aggregate({
        where: { interviewId },
        _max: { order: true },
      });
      const nextOrder = (maxOrderAgg._max.order ?? 0) + 1;

      return tx.interviewQuestion.create({
        data: {
          interviewId,
          questionBankId: null,
          order: nextOrder,
          topic: "Follow-up",
          questionText: text,
          type: "FOLLOW_UP",
          difficulty: "MID_LEVEL",
          tagsJson: ["AI"] as never,
        },
        select: { id: true },
      });
    });

    revalidatePath(`/interviews/${interviewId}/session`);
    revalidatePath(`/interviews/${interviewId}`);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to add follow-up question." };
  }
}

export async function generateEvaluationInsightAction(
  interviewId: string,
  interviewQuestionId: string,
): Promise<ActionResult<{ insight: Record<string, unknown> }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  try {
    const ctx = await requireOrgPermission(session.user.id, "interview:conduct");
    if (!hasPermission(ctx.role, "ai:use")) return { ok: false, error: "Insufficient permissions." };
    const allowed = await hasFeature(ctx.organization.id, "ai");
    if (!allowed) return { ok: false, error: "This feature is not available on your plan." };

    const result = await generateEvaluationInsight({ interviewId, interviewQuestionId, organizationId: ctx.organization.id });
    return { ok: true, data: { insight: result.insight } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to generate AI insight." };
  }
}

export async function generateInterviewSummaryAction(
  interviewId: string,
): Promise<ActionResult<{ summary: Record<string, unknown>; suggestedRecommendation: Recommendation | null }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  try {
    const ctx = await requireOrgPermission(session.user.id, "interview:conduct");
    if (!hasPermission(ctx.role, "ai:use")) return { ok: false, error: "Insufficient permissions." };
    const allowed = await hasFeature(ctx.organization.id, "ai");
    if (!allowed) return { ok: false, error: "This feature is not available on your plan." };

    const result = await generateInterviewSummary(interviewId, ctx.organization.id);
    return { ok: true, data: { summary: result.summary, suggestedRecommendation: result.suggestedRecommendation } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to generate AI summary." };
  }
}
