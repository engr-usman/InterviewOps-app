"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/services/access";
import {
  jobDescriptionFormInputSchema,
  normalizeJobDescriptionFormValues,
  type JobDescriptionFormInputValues,
} from "@/features/job-descriptions/job-description-schema";
import { analyzeAndStoreJobDescription } from "@/server/services/jd-service";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Db = {
  jobDescription: {
    create: (args: unknown) => Promise<{ id: string }>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
};

const db = prisma as unknown as Db;

export async function createJobDescriptionAction(
  input: JobDescriptionFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "jobDescription:manage");
  const parsed = jobDescriptionFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeJobDescriptionFormValues(parsed.data);

  const jd = await db.jobDescription.create({
    data: {
      createdById: session.user.id,
      organizationId: ctx.organization.id,
      title: values.title,
      department: values.department,
      location: values.location,
      seniorityLevel: values.seniorityLevel,
      descriptionText: values.descriptionText,
      requirementsText: values.requirementsText,
    },
    select: { id: true },
  });

  try {
    await analyzeAndStoreJobDescription({ jobDescriptionId: jd.id, organizationId: ctx.organization.id });
  } catch {}

  revalidatePath("/job-descriptions");
  return { ok: true, data: { id: jd.id } };
}

export async function updateJobDescriptionAction(
  id: string,
  input: JobDescriptionFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "jobDescription:manage");
  const parsed = jobDescriptionFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeJobDescriptionFormValues(parsed.data);

  const updated = await db.jobDescription.updateMany({
    where: {
      id,
      organizationId: ctx.organization.id,
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

  try {
    await analyzeAndStoreJobDescription({ jobDescriptionId: id, organizationId: ctx.organization.id });
  } catch {}

  revalidatePath("/job-descriptions");
  revalidatePath(`/job-descriptions/${id}`);
  return { ok: true, data: { id } };
}

export async function deleteJobDescriptionAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "jobDescription:manage");
  const deleted = await db.jobDescription.deleteMany({
    where: {
      id,
      organizationId: ctx.organization.id,
    },
  });

  if (deleted.count === 0) return { ok: false, error: "Job description not found." };

  revalidatePath("/job-descriptions");
  return { ok: true, data: { id } };
}
