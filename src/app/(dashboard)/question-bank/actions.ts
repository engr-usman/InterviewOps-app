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

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "questionBank:create");
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient permissions.") {
      return { ok: false, error: "Insufficient permissions." };
    }
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = questionFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeQuestionFormValues(parsed.data);

  const canManage = ctx.role === "OWNER" || ctx.role === "ADMIN";
  if (!canManage && values.visibility === "ORGANIZATION") {
    return { ok: false, error: "You do not have permission to share questions with the organization." };
  }

  const created = await prisma.questionBank.create({
    data: {
      organizationId: ctx.organization.id,
      createdById: session.user.id,
      visibility: canManage ? values.visibility : "PRIVATE",
      domain: values.domain,
      subDomain: values.subDomain ?? null,
      topic: values.topic,
      prompt: values.prompt,
      evaluationGuideText: values.evaluationGuideText ?? null,
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

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "questionBank:view");
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient permissions.") {
      return { ok: false, error: "Insufficient permissions." };
    }
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = questionFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeQuestionFormValues(parsed.data);

  const canManage = ctx.role === "OWNER" || ctx.role === "ADMIN";
  const canEditOwnPrivate = await prisma.questionBank.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: { createdById: true, visibility: true },
  });
  if (!canEditOwnPrivate) return { ok: false, error: "Question not found." };

  const isOwnPrivate = canEditOwnPrivate.visibility === "PRIVATE" && canEditOwnPrivate.createdById === session.user.id;
  if (!canManage && !isOwnPrivate) return { ok: false, error: "Insufficient permissions." };

  if (!canManage && values.visibility === "ORGANIZATION") {
    return { ok: false, error: "You do not have permission to share questions with the organization." };
  }

  const updated = await prisma.questionBank.updateMany({
    where: { id, organizationId: ctx.organization.id },
    data: {
      visibility: canManage ? values.visibility : undefined,
      domain: values.domain,
      subDomain: values.subDomain ?? null,
      topic: values.topic,
      prompt: values.prompt,
      evaluationGuideText: values.evaluationGuideText ?? null,
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

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "questionBank:view");
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient permissions.") {
      return { ok: false, error: "Insufficient permissions." };
    }
    return { ok: false, error: "Unauthorized." };
  }

  const canManage = ctx.role === "OWNER" || ctx.role === "ADMIN";
  const canManageOwn = ctx.role === "INTERVIEWER";
  if (!canManage && !canManageOwn) {
    return { ok: false, error: "Insufficient permissions." };
  }
  const deleted = await prisma.questionBank.deleteMany({
    where: {
      id,
      organizationId: ctx.organization.id,
      ...(canManage
        ? {}
        : {
            createdById: session.user.id,
            visibility: "PRIVATE",
          }),
    },
  });

  if (deleted.count === 0) return { ok: false, error: "Question not found." };

  revalidatePath("/question-bank");
  return { ok: true, data: { id } };
}
