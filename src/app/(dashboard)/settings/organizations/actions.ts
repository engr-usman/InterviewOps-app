"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrThrow, setActiveOrganization } from "@/server/services/org-context";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireActiveOwner(userId: string) {
  const ctx = await getOrgContextOrThrow(userId);
  if (ctx.role !== "OWNER") throw new Error("Access denied.");
  return ctx;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function updateOrganizationByOwnerAction(input: {
  organizationId: string;
  name: string;
  slug: string;
  website?: string;
  industry?: string;
  companySize?: string;
  logoUrl?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  try {
    await requireActiveOwner(session.user.id);
  } catch {
    return { ok: false, error: "Access denied." };
  }

  const organizationId = input.organizationId.trim();
  if (!organizationId) return { ok: false, error: "Organization is required." };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Organization name is required." };

  const slugRaw = input.slug.trim();
  const slug = slugify(slugRaw);
  if (slug.length < 2) return { ok: false, error: "Slug is required." };

  const existing = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Organization not found." };

  const slugConflict = await prisma.organization.findFirst({
    where: { slug, NOT: { id: organizationId } },
    select: { id: true },
  });
  if (slugConflict) return { ok: false, error: "That slug is already in use." };

  try {
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name,
        slug,
        website: input.website?.trim() || null,
        industry: input.industry?.trim() || null,
        companySize: input.companySize?.trim() || null,
        logoUrl: input.logoUrl?.trim() || null,
      },
      select: { id: true },
    });

    revalidatePath("/settings/organizations");
    revalidatePath(`/settings/organizations/${updated.id}`);
    revalidatePath(`/settings/organizations/${updated.id}/edit`);
    revalidatePath("/settings/organization");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update organization." };
  }
}

export async function deleteOrganizationByOwnerAction(input: {
  organizationId: string;
  confirmationText: string;
  confirmed: boolean;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  let activeOrgId: string | null = null;
  try {
    const ctx = await requireActiveOwner(session.user.id);
    activeOrgId = ctx.organization.id;
  } catch {
    return { ok: false, error: "Access denied." };
  }

  const organizationId = input.organizationId.trim();
  if (!organizationId) return { ok: false, error: "Organization is required." };

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true },
  });
  if (!org) return { ok: false, error: "Organization not found." };

  if (!input.confirmed) return { ok: false, error: "You must confirm that you understand this action cannot be undone." };

  const typed = input.confirmationText.trim();
  if (typed !== org.slug && typed !== org.name) {
    return { ok: false, error: "Confirmation text does not match the organization name or slug." };
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    select: { organizationId: true },
    take: 100,
  });
  const remainingOrgIds = memberships.map((m) => m.organizationId).filter((id) => id !== organizationId);

  if (organizationId === activeOrgId && remainingOrgIds.length === 0) {
    return { ok: false, error: "You cannot delete your only active organization." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.organization.delete({ where: { id: organizationId } });
      if (organizationId === activeOrgId) {
        const nextOrgId = remainingOrgIds[0] ?? null;
        if (nextOrgId) await setActiveOrganization(session.user.id, nextOrgId);
      }
    });

    revalidatePath("/settings/organizations");
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    revalidatePath("/settings/organization");
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to delete organization." };
  }
}

