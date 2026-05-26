"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setActiveOrganization } from "@/server/services/org-context";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Db = {
  organization: {
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
    create: (args: unknown) => Promise<{ id: string }>;
  };
  subscriptionPlan: {
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
  };
};

const db = prisma as unknown as Db;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const attempt = slugify(base) || "org";
  const existing = await db.organization.findUnique({ where: { slug: attempt }, select: { id: true } });
  if (!existing) return attempt;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${attempt}-${suffix}`.slice(0, 60);
}

export async function createOrganizationAction(input: { name: string }): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Organization name is required." };

  try {
    const slug = await ensureUniqueSlug(name);

    const freePlan = await db.subscriptionPlan.findUnique({ where: { code: "FREE" }, select: { id: true } });
    const planId = freePlan?.id ?? null;

    const org = await db.organization.create({
      data: {
        name,
        slug,
        createdById: session.user.id,
        members: { create: { userId: session.user.id, role: "OWNER" } },
        ...(planId
          ? {
              subscriptions: {
                create: { planId, status: "ACTIVE" },
              },
            }
          : {}),
      },
      select: { id: true },
    });

    await setActiveOrganization(session.user.id, org.id);
    revalidatePath("/onboarding");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: org.id } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to create organization." };
  }
}

export async function setActiveOrganizationAction(input: { organizationId: string }): Promise<ActionResult<{ ok: true }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  try {
    await setActiveOrganization(session.user.id, input.organizationId);
    revalidatePath("/onboarding");
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    revalidatePath("/settings/organization");
    revalidatePath("/settings/team");
    revalidatePath("/settings/billing");
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to set organization." };
  }
}
