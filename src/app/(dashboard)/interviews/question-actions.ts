"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/services/access";
import {
  addQuestionSchema,
  generateQuestionsSchema,
  type GenerateQuestionsValues,
} from "@/features/interviews/interview-question-schema";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Db = {
  interview: {
    findFirst: (args: unknown) => Promise<{ id: string; status: string } | null>;
  };
};

function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function resequenceInterviewQuestions(tx: Prisma.TransactionClient, interviewId: string) {
  const remaining = await tx.interviewQuestion.findMany({
    where: { interviewId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  for (let i = 0; i < remaining.length; i += 1) {
    await tx.interviewQuestion.update({
      where: { id: remaining[i].id },
      data: { order: i + 1 },
    });
  }
}

const permissionDeniedMessage = "You do not have permission to perform this action.";

export async function generateInterviewQuestionsAction(
  interviewId: string,
  input: unknown,
): Promise<ActionResult<{ createdCount: number }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "interview:questions:manage");
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient permissions.") {
      return { ok: false, error: permissionDeniedMessage };
    }
    return { ok: false, error: "Unauthorized." };
  }
  const parsed = generateQuestionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid inputs." };

  const values: GenerateQuestionsValues = parsed.data;

  try {
    const db = prisma as unknown as Db;
    const interview = await db.interview.findFirst({
      where: { id: interviewId, organizationId: ctx.organization.id },
      select: { id: true, status: true },
    });
    if (!interview) throw new Error("Interview not found.");
    if (interview.status === "COMPLETED") {
      throw new Error("Completed interviews cannot be modified. Reopen the interview first.");
    }

    const createdCount = await prisma.$transaction(async (tx) => {
      const existing = await tx.interviewQuestion.findMany({
        where: { interviewId },
        select: { questionBankId: true },
      });
      const existingBankIds = existing
        .map((q) => q.questionBankId)
        .filter((id): id is string => typeof id === "string");

      const maxOrderAgg = await tx.interviewQuestion.aggregate({
        where: { interviewId },
        _max: { order: true },
      });
      const startOrder = (maxOrderAgg._max.order ?? 0) + 1;

      const candidateQuestions = await tx.questionBank.findMany({
        where: {
          ...(values.topic ? { topic: values.topic } : {}),
          ...(values.difficulty ? { difficulty: values.difficulty } : {}),
          ...(values.seniorityLevel ? { seniorityLevel: values.seniorityLevel } : {}),
          ...(values.type ? { type: values.type } : {}),
          ...(existingBankIds.length > 0 ? { id: { notIn: existingBankIds } } : {}),
        },
        select: {
          id: true,
          prompt: true,
          topic: true,
          type: true,
          difficulty: true,
          tagsJson: true,
        },
        take: 500,
      });

      const selected = shuffle(candidateQuestions).slice(0, values.count);
      if (selected.length === 0) return 0;

      await tx.interviewQuestion.createMany({
        data: selected.map((q, index) => ({
          interviewId,
          questionBankId: q.id,
          order: startOrder + index,
          questionText: q.prompt,
          topic: q.topic,
          type: q.type,
          difficulty: q.difficulty,
          tagsJson: q.tagsJson ?? undefined,
        })),
      });

      await resequenceInterviewQuestions(tx, interviewId);
      return selected.length;
    });

    revalidatePath(`/interviews/${interviewId}`);
    return { ok: true, data: { createdCount } };
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message };
    return { ok: false, error: "Failed to generate questions." };
  }
}

export async function addInterviewQuestionFromBankAction(
  interviewId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "interview:questions:manage");
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient permissions.") {
      return { ok: false, error: permissionDeniedMessage };
    }
    return { ok: false, error: "Unauthorized." };
  }
  const parsed = addQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid inputs." };

  try {
    const db = prisma as unknown as Db;
    const interview = await db.interview.findFirst({
      where: { id: interviewId, organizationId: ctx.organization.id },
      select: { id: true, status: true },
    });
    if (!interview) throw new Error("Interview not found.");
    if (interview.status === "COMPLETED") {
      throw new Error("Completed interviews cannot be modified. Reopen the interview first.");
    }

    const created = await prisma.$transaction(async (tx) => {
      const qb = await tx.questionBank.findUnique({
        where: { id: parsed.data.questionBankId },
        select: { id: true, prompt: true, topic: true, type: true, difficulty: true, tagsJson: true },
      });
      if (!qb) throw new Error("Question not found.");

      const exists = await tx.interviewQuestion.findFirst({
        where: { interviewId, questionBankId: qb.id },
        select: { id: true },
      });
      if (exists) throw new Error("This question is already added to the interview.");

      const maxOrderAgg = await tx.interviewQuestion.aggregate({
        where: { interviewId },
        _max: { order: true },
      });
      const nextOrder = (maxOrderAgg._max.order ?? 0) + 1;

      const created = await tx.interviewQuestion.create({
        data: {
          interviewId,
          questionBankId: qb.id,
          order: nextOrder,
          questionText: qb.prompt,
          topic: qb.topic,
          type: qb.type,
          difficulty: qb.difficulty,
          tagsJson: qb.tagsJson ?? undefined,
        },
        select: { id: true },
      });

      await resequenceInterviewQuestions(tx, interviewId);
      return created;
    });

    revalidatePath(`/interviews/${interviewId}`);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message };
    return { ok: false, error: "Failed to add question." };
  }
}

export async function removeInterviewQuestionAction(
  interviewId: string,
  interviewQuestionId: string,
): Promise<ActionResult<{ removedId: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "interview:questions:manage");
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient permissions.") {
      return { ok: false, error: permissionDeniedMessage };
    }
    return { ok: false, error: "Unauthorized." };
  }
  try {
    const db = prisma as unknown as Db;
    const interview = await db.interview.findFirst({
      where: { id: interviewId, organizationId: ctx.organization.id },
      select: { id: true, status: true },
    });
    if (!interview) throw new Error("Interview not found.");
    if (interview.status === "COMPLETED") {
      throw new Error("Completed interviews cannot be modified. Reopen the interview first.");
    }

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.interviewQuestion.deleteMany({
        where: { id: interviewQuestionId, interviewId },
      });
      if (deleted.count === 0) throw new Error("Question not found.");

      await resequenceInterviewQuestions(tx, interviewId);
    });

    revalidatePath(`/interviews/${interviewId}`);
    return { ok: true, data: { removedId: interviewQuestionId } };
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message };
    return { ok: false, error: "Failed to remove question." };
  }
}
