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

async function requireCurrentDbUser() {
  const session = await getServerAuthSession();
  const email = session?.user?.email ?? null;
  if (!email) throw new Error("Unauthorized.");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) throw new Error("Unauthorized.");
  return { session, user };
}

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
  let session: Awaited<ReturnType<typeof getServerAuthSession>> | null = null;
  let userId: string | null = null;
  try {
    const resolved = await requireCurrentDbUser();
    session = resolved.session;
    userId = resolved.user.id;
  } catch {
    return { ok: false, error: "Unauthorized." };
  }

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
        createdById: userId,
        members: { create: { userId, role: "OWNER" } },
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

    await setActiveOrganization(userId, org.id);
    revalidatePath("/onboarding");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: org.id } };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const safe = {
        sessionEmail: session?.user?.email ?? null,
        sessionUserId: (session?.user as { id?: unknown } | undefined)?.id ?? null,
        dbUserId: userId,
        message: error instanceof Error ? error.message : "Unknown error",
      };
      console.error("createOrganizationAction failed", safe);
    }
    return { ok: false, error: "Unable to create organization. Please try again or contact support." };
  }
}

export async function setActiveOrganizationAction(input: { organizationId: string }): Promise<ActionResult<{ ok: true }>> {
  let userId: string | null = null;
  try {
    const resolved = await requireCurrentDbUser();
    userId = resolved.user.id;
  } catch {
    return { ok: false, error: "Unauthorized." };
  }

  try {
    await setActiveOrganization(userId, input.organizationId);
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
