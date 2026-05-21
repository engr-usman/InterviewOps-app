"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  interviewFormInputSchema,
  normalizeInterviewFormValues,
  type InterviewFormInputValues,
} from "@/features/interviews/interview-schema";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createInterviewAction(
  input: InterviewFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const parsed = interviewFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeInterviewFormValues(parsed.data);

  const candidate = await prisma.candidate.findFirst({
    where: { id: values.candidateId, createdById: session.user.id },
    select: { id: true },
  });
  if (!candidate) return { ok: false, error: "Candidate not found." };

  const jobDescription = await prisma.jobDescription.findFirst({
    where: { id: values.jobDescriptionId, createdById: session.user.id },
    select: { id: true },
  });
  if (!jobDescription) return { ok: false, error: "Job description not found." };

  const created = await prisma.interview.create({
    data: {
      createdById: session.user.id,
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

  const parsed = interviewFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeInterviewFormValues(parsed.data);

  const candidate = await prisma.candidate.findFirst({
    where: { id: values.candidateId, createdById: session.user.id },
    select: { id: true },
  });
  if (!candidate) return { ok: false, error: "Candidate not found." };

  const jobDescription = await prisma.jobDescription.findFirst({
    where: { id: values.jobDescriptionId, createdById: session.user.id },
    select: { id: true },
  });
  if (!jobDescription) return { ok: false, error: "Job description not found." };

  const updated = await prisma.interview.updateMany({
    where: { id, createdById: session.user.id },
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

  const deleted = await prisma.interview.deleteMany({
    where: { id, createdById: session.user.id },
  });

  if (deleted.count === 0) return { ok: false, error: "Interview not found." };

  revalidatePath("/interviews");
  return { ok: true, data: { id } };
}
