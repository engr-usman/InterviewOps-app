"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgPermission } from "@/server/services/access";
import { orgRoleValues, type OrgRole } from "@/server/services/rbac";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Db = {
  organizationMember: {
    findFirst: (args: unknown) => Promise<{ id: string; userId: string; role: string } | null>;
    update: (args: unknown) => Promise<{ id: string }>;
    delete: (args: unknown) => Promise<unknown>;
  };
  inviteToken: {
    create: (args: unknown) => Promise<{ id: string }>;
  };
};

const db = prisma as unknown as Db;

export async function updateMemberRoleAction(input: { memberId: string; role: OrgRole }): Promise<ActionResult<{ ok: true }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  if (!(orgRoleValues as readonly string[]).includes(input.role)) return { ok: false, error: "Invalid role." };

  try {
    const ctx = await requireOrgPermission(session.user.id, "team:manage");

    const member = await db.organizationMember.findFirst({
      where: { id: input.memberId, organizationId: ctx.organization.id },
      select: { id: true, userId: true, role: true },
    });
    if (!member) return { ok: false, error: "Member not found." };

    if (member.role === "OWNER" && ctx.role !== "OWNER") {
      return { ok: false, error: "Only the owner can change the owner's role." };
    }
    if (input.role === "OWNER" && ctx.role !== "OWNER") {
      return { ok: false, error: "Only the owner can assign the owner role." };
    }
    if (member.role === "OWNER" && input.role !== "OWNER") {
      const ownersCount = await prisma.organizationMember.count({ where: { organizationId: ctx.organization.id, role: "OWNER" } });
      if (ownersCount <= 1) {
        return { ok: false, error: "Organization must have at least one owner." };
      }
    }
    if (member.userId === session.user.id && input.role !== member.role) {
      return { ok: false, error: "You cannot change your own role." };
    }

    await db.organizationMember.update({
      where: { id: member.id },
      data: { role: input.role },
      select: { id: true },
    });

    revalidatePath("/settings/team");
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update role." };
  }
}

export async function removeMemberAction(input: { memberId: string }): Promise<ActionResult<{ ok: true }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  try {
    const ctx = await requireOrgPermission(session.user.id, "team:manage");

    const member = await db.organizationMember.findFirst({
      where: { id: input.memberId, organizationId: ctx.organization.id },
      select: { id: true, userId: true, role: true },
    });
    if (!member) return { ok: false, error: "Member not found." };

    if (member.userId === session.user.id) return { ok: false, error: "You cannot remove yourself." };
    if (member.role === "OWNER" && ctx.role !== "OWNER") return { ok: false, error: "Only the owner can remove the owner." };
    if (member.role === "OWNER") {
      const ownersCount = await prisma.organizationMember.count({ where: { organizationId: ctx.organization.id, role: "OWNER" } });
      if (ownersCount <= 1) return { ok: false, error: "Organization must have at least one owner." };
    }

    await db.organizationMember.delete({ where: { id: member.id } });
    revalidatePath("/settings/team");
    return { ok: true, data: { ok: true } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to remove member." };
  }
}

export async function createInviteTokenAction(
  input: { email: string; role: OrgRole },
): Promise<ActionResult<{ inviteUrl: string; email: string; role: OrgRole; expiresAt: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, error: "Valid email is required." };
  if (!(orgRoleValues as readonly string[]).includes(input.role)) return { ok: false, error: "Invalid role." };

  try {
    const ctx = await requireOrgPermission(session.user.id, "team:manage");
    if (input.role === "OWNER" && ctx.role !== "OWNER") {
      return { ok: false, error: "Only the owner can invite a new owner." };
    }
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await db.inviteToken.create({
      data: {
        organizationId: ctx.organization.id,
        email,
        role: input.role,
        token,
        expiresAt,
        createdById: session.user.id,
      },
      select: { id: true },
    });

    const baseUrlRaw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const baseUrl = baseUrlRaw.endsWith("/") ? baseUrlRaw.slice(0, -1) : baseUrlRaw;
    const inviteUrl = `${baseUrl}/invite/${token}`;

    revalidatePath("/settings/team");
    return { ok: true, data: { inviteUrl, email, role: input.role, expiresAt: expiresAt.toISOString() } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to create invite." };
  }
}
