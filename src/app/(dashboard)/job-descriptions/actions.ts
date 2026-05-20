"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  jobDescriptionFormInputSchema,
  normalizeJobDescriptionFormValues,
  type JobDescriptionFormInputValues,
} from "@/features/job-descriptions/job-description-schema";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createJobDescriptionAction(
  input: JobDescriptionFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const parsed = jobDescriptionFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeJobDescriptionFormValues(parsed.data);

  const jd = await prisma.jobDescription.create({
    data: {
      createdById: session.user.id,
      title: values.title,
      department: values.department,
      location: values.location,
      seniorityLevel: values.seniorityLevel,
      descriptionText: values.descriptionText,
      requirementsText: values.requirementsText,
    },
    select: { id: true },
  });

  revalidatePath("/job-descriptions");
  return { ok: true, data: { id: jd.id } };
}

export async function updateJobDescriptionAction(
  id: string,
  input: JobDescriptionFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const parsed = jobDescriptionFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeJobDescriptionFormValues(parsed.data);

  const updated = await prisma.jobDescription.updateMany({
    where: {
      id,
      createdById: session.user.id,
    },
    data: {
      title: values.title,
      department: values.department,
      location: values.location,
      seniorityLevel: values.seniorityLevel,
      descriptionText: values.descriptionText,
      requirementsText: values.requirementsText,
    },
  });

  if (updated.count === 0) return { ok: false, error: "Job description not found." };

  revalidatePath("/job-descriptions");
  revalidatePath(`/job-descriptions/${id}`);
  return { ok: true, data: { id } };
}

export async function deleteJobDescriptionAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const deleted = await prisma.jobDescription.deleteMany({
    where: {
      id,
      createdById: session.user.id,
    },
  });

  if (deleted.count === 0) return { ok: false, error: "Job description not found." };

  revalidatePath("/job-descriptions");
  return { ok: true, data: { id } };
}
