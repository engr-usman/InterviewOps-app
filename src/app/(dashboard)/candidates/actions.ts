"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  candidateFormInputSchema,
  normalizeCandidateFormValues,
  type CandidateFormInputValues,
} from "@/features/candidates/candidate-schema";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createCandidateAction(
  input: CandidateFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const parsed = candidateFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeCandidateFormValues(parsed.data);

  const candidate = await prisma.candidate.create({
    data: {
      createdById: session.user.id,
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      location: values.location,
      seniorityLevel: values.seniorityLevel,
      linkedInUrl: values.linkedInUrl,
      githubUrl: values.githubUrl,
    },
    select: { id: true },
  });

  revalidatePath("/candidates");
  return { ok: true, data: { id: candidate.id } };
}

export async function updateCandidateAction(
  id: string,
  input: CandidateFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const parsed = candidateFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeCandidateFormValues(parsed.data);

  const updated = await prisma.candidate.updateMany({
    where: {
      id,
      createdById: session.user.id,
    },
    data: {
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      location: values.location,
      seniorityLevel: values.seniorityLevel,
      linkedInUrl: values.linkedInUrl,
      githubUrl: values.githubUrl,
    },
  });

  if (updated.count === 0) return { ok: false, error: "Candidate not found." };

  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  return { ok: true, data: { id } };
}

export async function deleteCandidateAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const deleted = await prisma.candidate.deleteMany({
    where: {
      id,
      createdById: session.user.id,
    },
  });

  if (deleted.count === 0) return { ok: false, error: "Candidate not found." };

  revalidatePath("/candidates");
  return { ok: true, data: { id } };
}
