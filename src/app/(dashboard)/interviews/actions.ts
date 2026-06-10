"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/services/access";
import {
  interviewFormInputSchema,
  normalizeInterviewFormValues,
  type InterviewFormInputValues,
} from "@/features/interviews/interview-schema";

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

type Db = {
  candidate: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  jobDescription: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  organizationMember: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  interview: {
    create: (args: unknown) => Promise<{ id: string }>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
};

const db = prisma as unknown as Db;

const permissionDeniedMessage = "You do not have permission to perform this action.";

export async function createInterviewAction(
  input: InterviewFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, message: "Unauthorized." };

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "interview:manage");
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient permissions.") {
      return { ok: false, message: permissionDeniedMessage };
    }
    return { ok: false, message: "Unauthorized." };
  }
  const parsed = interviewFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid form data." };
  const values = normalizeInterviewFormValues(parsed.data);

  const candidate = await db.candidate.findFirst({
    where: { id: values.candidateId, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!candidate) return { ok: false, message: "Candidate not found." };

  const jobDescription = await db.jobDescription.findFirst({
    where: { id: values.jobDescriptionId, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!jobDescription) return { ok: false, message: "Job description not found." };

  const member = await db.organizationMember.findFirst({
    where: {
      organizationId: ctx.organization.id,
      userId: values.assignedInterviewerId,
      role: { in: ["OWNER", "ADMIN", "INTERVIEWER"] },
    },
    select: { id: true },
  });
  if (!member) return { ok: false, message: "Assigned interviewer not found." };

  try {
    const created = await db.interview.create({
      data: {
        createdById: session.user.id,
        organizationId: ctx.organization.id,
        candidateId: values.candidateId,
        jobDescriptionId: values.jobDescriptionId,
        assignedInterviewerId: values.assignedInterviewerId,
        status: values.status,
        scheduledStartAt: values.scheduledStartAt,
        scheduledEndAt: values.scheduledEndAt,
        meetingUrl: values.meetingUrl,
        notesText: values.notesText,
      },
      select: { id: true },
    });

    revalidatePath("/interviews");
    return { ok: true, data: { id: created.id } };
  } catch {
    return { ok: false, message: "Failed to create interview." };
  }
}

export async function updateInterviewAction(
  id: string,
  input: InterviewFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, message: "Unauthorized." };

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "interview:manage");
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient permissions.") {
      return { ok: false, message: permissionDeniedMessage };
    }
    return { ok: false, message: "Unauthorized." };
  }
  const parsed = interviewFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid form data." };
  const values = normalizeInterviewFormValues(parsed.data);

  const candidate = await db.candidate.findFirst({
    where: { id: values.candidateId, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!candidate) return { ok: false, message: "Candidate not found." };

  const jobDescription = await db.jobDescription.findFirst({
    where: { id: values.jobDescriptionId, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!jobDescription) return { ok: false, message: "Job description not found." };

  const member = await db.organizationMember.findFirst({
    where: {
      organizationId: ctx.organization.id,
      userId: values.assignedInterviewerId,
      role: { in: ["OWNER", "ADMIN", "INTERVIEWER"] },
    },
    select: { id: true },
  });
  if (!member) return { ok: false, message: "Assigned interviewer not found." };

  try {
    const updated = await db.interview.updateMany({
      where: { id, organizationId: ctx.organization.id },
      data: {
        candidateId: values.candidateId,
        jobDescriptionId: values.jobDescriptionId,
        assignedInterviewerId: values.assignedInterviewerId,
        status: values.status,
        scheduledStartAt: values.scheduledStartAt,
        scheduledEndAt: values.scheduledEndAt,
        meetingUrl: values.meetingUrl,
        notesText: values.notesText,
      },
    });

    if (updated.count === 0) return { ok: false, message: "Interview not found." };

    revalidatePath("/interviews");
    revalidatePath(`/interviews/${id}`);
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, message: "Failed to update interview." };
  }
}

export async function deleteInterviewAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, message: "Unauthorized." };

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "interview:manage");
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient permissions.") {
      return { ok: false, message: permissionDeniedMessage };
    }
    return { ok: false, message: "Unauthorized." };
  }

  try {
    const deleted = await db.interview.deleteMany({
      where: { id, organizationId: ctx.organization.id },
    });

    if (deleted.count === 0) return { ok: false, message: "Interview not found." };

    revalidatePath("/interviews");
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, message: "Failed to delete interview." };
  }
}

export async function reopenInterviewAction(interviewId: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, message: "Unauthorized." };

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "interview:manage");
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient permissions.") {
      return { ok: false, message: permissionDeniedMessage };
    }
    return { ok: false, message: "Unauthorized." };
  }

  try {
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const interview = await tx.interview.findFirst({
        where: { id: interviewId, organizationId: ctx.organization.id },
        select: { id: true, status: true, metadataJson: true },
      });
      if (!interview) throw new Error("Interview not found.");
      if (interview.status !== "COMPLETED") throw new Error("Only completed interviews can be reopened.");

      const existingMeta = interview.metadataJson;
      const baseMeta =
        existingMeta && typeof existingMeta === "object" && !Array.isArray(existingMeta)
          ? (existingMeta as Record<string, unknown>)
          : {};
      const existingCountRaw = baseMeta.reopenCount;
      const existingCount = typeof existingCountRaw === "number" && Number.isFinite(existingCountRaw) ? existingCountRaw : 0;
      const reopenCount = existingCount + 1;

      await tx.interview.update({
        where: { id: interviewId },
        data: {
          status: "IN_PROGRESS",
          endedAt: null,
          metadataJson: {
            ...baseMeta,
            reopenedAt: now.toISOString(),
            reopenedById: session.user.id,
            reopenCount,
          } as never,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "INTERVIEW_REOPENED",
          entityType: "Interview",
          entityId: interviewId,
          metadataJson: {
            previousStatus: "COMPLETED",
            newStatus: "IN_PROGRESS",
            reopenCount,
          } as never,
        },
        select: { id: true },
      });

      return { id: interviewId };
    });

    revalidatePath(`/interviews/${interviewId}/session`);
    revalidatePath(`/interviews/${interviewId}`);
    revalidatePath("/interviews");
    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof Error) return { ok: false, message: error.message };
    return { ok: false, message: "Failed to reopen interview." };
  }
}
