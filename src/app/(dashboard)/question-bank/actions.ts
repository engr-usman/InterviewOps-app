"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/services/access";
import {
  normalizeQuestionFormValues,
  questionFormInputSchema,
  type QuestionFormInputValues,
} from "@/features/question-bank/question-schema";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createQuestionAction(
  input: QuestionFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  try {
    await requireOrgPermission(session.user.id, "questionBank:create");
  } catch {
    return { ok: false, error: "Insufficient permissions." };
  }

  const parsed = questionFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeQuestionFormValues(parsed.data);

  const created = await prisma.questionBank.create({
    data: {
      topic: values.topic,
      prompt: values.prompt,
      type: values.type,
      difficulty: values.difficulty,
      seniorityLevel: values.seniorityLevel,
      sourceType: values.sourceType ?? "MANUAL",
      tagsJson: values.tags ?? undefined,
    },
    select: { id: true },
  });

  revalidatePath("/question-bank");
  return { ok: true, data: { id: created.id } };
}

export async function updateQuestionAction(
  id: string,
  input: QuestionFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  try {
    await requireOrgPermission(session.user.id, "questionBank:manage");
  } catch {
    return { ok: false, error: "Insufficient permissions." };
  }

  const parsed = questionFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeQuestionFormValues(parsed.data);

  const updated = await prisma.questionBank.updateMany({
    where: { id },
    data: {
      topic: values.topic,
      prompt: values.prompt,
      type: values.type,
      difficulty: values.difficulty,
      seniorityLevel: values.seniorityLevel,
      sourceType: values.sourceType ?? "MANUAL",
      tagsJson: values.tags ?? undefined,
    },
  });

  if (updated.count === 0) return { ok: false, error: "Question not found." };

  revalidatePath("/question-bank");
  revalidatePath(`/question-bank/${id}`);
  return { ok: true, data: { id } };
}

export async function deleteQuestionAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  try {
    await requireOrgPermission(session.user.id, "questionBank:manage");
  } catch {
    return { ok: false, error: "Insufficient permissions." };
  }

  const deleted = await prisma.questionBank.deleteMany({
    where: { id },
  });

  if (deleted.count === 0) return { ok: false, error: "Question not found." };

  revalidatePath("/question-bank");
  return { ok: true, data: { id } };
}
