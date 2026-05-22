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

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Db = {
  candidate: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  jobDescription: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  interview: {
    create: (args: unknown) => Promise<{ id: string }>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
};

const db = prisma as unknown as Db;

export async function createInterviewAction(
  input: InterviewFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "interview:manage");
  const parsed = interviewFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeInterviewFormValues(parsed.data);

  const candidate = await db.candidate.findFirst({
    where: { id: values.candidateId, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!candidate) return { ok: false, error: "Candidate not found." };

  const jobDescription = await db.jobDescription.findFirst({
    where: { id: values.jobDescriptionId, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!jobDescription) return { ok: false, error: "Job description not found." };

  const created = await db.interview.create({
    data: {
      createdById: session.user.id,
      organizationId: ctx.organization.id,
      candidateId: values.candidateId,
      jobDescriptionId: values.jobDescriptionId,
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
}

export async function updateInterviewAction(
  id: string,
  input: InterviewFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "interview:manage");
  const parsed = interviewFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeInterviewFormValues(parsed.data);

  const candidate = await db.candidate.findFirst({
    where: { id: values.candidateId, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!candidate) return { ok: false, error: "Candidate not found." };

  const jobDescription = await db.jobDescription.findFirst({
    where: { id: values.jobDescriptionId, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!jobDescription) return { ok: false, error: "Job description not found." };

  const updated = await db.interview.updateMany({
    where: { id, organizationId: ctx.organization.id },
    data: {
      candidateId: values.candidateId,
      jobDescriptionId: values.jobDescriptionId,
      status: values.status,
      scheduledStartAt: values.scheduledStartAt,
      scheduledEndAt: values.scheduledEndAt,
      meetingUrl: values.meetingUrl,
      notesText: values.notesText,
    },
  });

  if (updated.count === 0) return { ok: false, error: "Interview not found." };

  revalidatePath("/interviews");
  revalidatePath(`/interviews/${id}`);
  return { ok: true, data: { id } };
}

export async function deleteInterviewAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "interview:manage");
  const deleted = await db.interview.deleteMany({
    where: { id, organizationId: ctx.organization.id },
  });

  if (deleted.count === 0) return { ok: false, error: "Interview not found." };

  revalidatePath("/interviews");
  return { ok: true, data: { id } };
}
