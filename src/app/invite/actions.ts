"use server";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: "EMAIL_EXISTS" | "INVITE_INVALID" | "INVITE_USED" };

function getInviteUsedAt(metadataJson: unknown): string | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const usedAt = (metadataJson as { usedAt?: unknown }).usedAt;
  return typeof usedAt === "string" && usedAt.length > 0 ? usedAt : null;
}

export async function acceptInviteCreateAccountAction(input: {
  token: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<ActionResult<{ ok: true }>> {
  const token = input.token.trim();
  if (!token) return { ok: false, code: "INVITE_INVALID", error: "Invite link is invalid or expired." };

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, error: "Valid email is required." };

  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Full name is required." };

  if (!input.password || input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (input.password !== input.confirmPassword) return { ok: false, error: "Passwords do not match." };

  const invite = await prisma.inviteToken.findUnique({
    where: { token },
    select: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      expiresAt: true,
      createdById: true,
      metadataJson: true,
    },
  });

  if (!invite || invite.expiresAt < new Date()) {
    return { ok: false, code: "INVITE_INVALID", error: "Invite link is invalid or expired." };
  }

  if (getInviteUsedAt(invite.metadataJson)) {
    return { ok: false, code: "INVITE_USED", error: "This invite link has already been used." };
  }

  if (invite.email.trim().toLowerCase() !== email) {
    return { ok: false, error: "This invite was sent to a different email address." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    return {
      ok: false,
      code: "EMAIL_EXISTS",
      error: "This email already has an account. Please sign in to accept the invite.",
    };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: fullName,
          passwordHash,
          activeOrganizationId: invite.organizationId,
        },
        select: { id: true },
      });

      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: invite.organizationId, userId: user.id } },
        update: { role: invite.role },
        create: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: invite.role,
          invitedById: invite.createdById ?? null,
          joinedAt: new Date(),
        },
        select: { id: true },
      });

      const existingMeta =
        invite.metadataJson && typeof invite.metadataJson === "object" ? (invite.metadataJson as Record<string, unknown>) : {};
      await tx.inviteToken.update({
        where: { id: invite.id },
        data: {
          metadataJson: {
            ...existingMeta,
            usedAt: new Date().toISOString(),
            usedById: user.id,
          },
        },
        select: { id: true },
      });
    });

    return { ok: true, data: { ok: true } };
  } catch {
    return { ok: false, error: "Unable to accept invite. Please try again." };
  }
}

