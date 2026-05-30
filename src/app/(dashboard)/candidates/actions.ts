"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/services/access";
import {
  candidateFormInputSchema,
  normalizeCandidateFormValues,
  normalizeEmail,
  type CandidateFormInputValues,
} from "@/features/candidates/candidate-schema";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Db = {
  candidate: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
    create: (args: unknown) => Promise<{ id: string }>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
};

const db = prisma as unknown as Db;

export async function createCandidateAction(
  input: CandidateFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "candidate:manage");
  const parsed = candidateFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeCandidateFormValues(parsed.data);
  const email = normalizeEmail(parsed.data.email ?? null);

  if (email) {
    const existing = await db.candidate.findFirst({
      where: {
        organizationId: ctx.organization.id,
        email,
      },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: "A candidate with this email already exists in this organization." };
    }
  }

  try {
    const candidate = await db.candidate.create({
      data: {
        createdById: session.user.id,
        organizationId: ctx.organization.id,
        fullName: values.fullName,
        email: email ?? undefined,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A candidate with this email already exists in this organization." };
    }
    return { ok: false, error: "Failed to create candidate." };
  }
}

export async function updateCandidateAction(
  id: string,
  input: CandidateFormInputValues,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "candidate:manage");
  const parsed = candidateFormInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid form data." };
  const values = normalizeCandidateFormValues(parsed.data);
  const email = normalizeEmail(parsed.data.email ?? null);

  if (email) {
    const existing = await db.candidate.findFirst({
      where: {
        organizationId: ctx.organization.id,
        email,
        NOT: { id },
      },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: "A candidate with this email already exists in this organization." };
    }
  }

  try {
    const updated = await db.candidate.updateMany({
      where: {
        id,
        organizationId: ctx.organization.id,
      },
      data: {
        fullName: values.fullName,
        email: email ?? undefined,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A candidate with this email already exists in this organization." };
    }
    return { ok: false, error: "Failed to update candidate." };
  }
}

export async function deleteCandidateAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await requireOrgPermission(session.user.id, "candidate:manage");
  const deleted = await db.candidate.deleteMany({
    where: {
      id,
      organizationId: ctx.organization.id,
    },
  });

  if (deleted.count === 0) return { ok: false, error: "Candidate not found." };

  revalidatePath("/candidates");
  return { ok: true, data: { id } };
}
