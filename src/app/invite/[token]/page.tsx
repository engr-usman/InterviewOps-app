import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { setActiveOrganization } from "@/server/services/org-context";
import { InviteAcceptForm } from "@/features/orgs/invite-accept-form";

function getInviteUsedAt(metadataJson: unknown): string | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const usedAt = (metadataJson as { usedAt?: unknown }).usedAt;
  return typeof usedAt === "string" && usedAt.length > 0 ? usedAt : null;
}

export default async function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const session = await getServerAuthSession();
  const { token } = await params;

  const invite = await prisma.inviteToken.findUnique({
    where: { token },
    select: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      expiresAt: true,
      metadataJson: true,
      organization: { select: { name: true } },
    },
  });

  const now = new Date();
  if (!invite || invite.expiresAt < now) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Invalid invite</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">This invite link is invalid or expired.</CardContent>
        </Card>
      </div>
    );
  }

  const usedAt = getInviteUsedAt(invite.metadataJson);
  if (usedAt) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Invite already used</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This invite link has already been used.
            <div className="mt-3">
              <Button asChild variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loginUrl = `/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`;

  if (!session?.user?.id) {
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email.trim().toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      return (
        <div className="flex min-h-dvh items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>This email already has an account. Please sign in to accept the invite.</div>
              <Button asChild>
                <Link href={loginUrl}>Sign in and accept invite</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <InviteAcceptForm
          token={token}
          organizationName={invite.organization.name}
          invitedEmail={invite.email}
          invitedRole={invite.role}
          expiresAt={invite.expiresAt.toLocaleString()}
          loginUrl={loginUrl}
        />
      </div>
    );
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true },
  });

  const invitedEmail = invite.email.trim().toLowerCase();
  const currentEmail = currentUser?.email.trim().toLowerCase() ?? "";

  if (invitedEmail !== currentEmail) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Wrong account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>This invite was sent to {invite.email}. Please sign in with that email.</div>
            <Button asChild>
              <Link href={loginUrl}>Sign in with the invited email</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const inviteFresh = await tx.inviteToken.findUnique({
        where: { token },
        select: { id: true, organizationId: true, role: true, expiresAt: true, metadataJson: true },
      });
      if (!inviteFresh || inviteFresh.expiresAt < new Date()) throw new Error("INVITE_INVALID");
      if (getInviteUsedAt(inviteFresh.metadataJson)) throw new Error("INVITE_USED");

      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: inviteFresh.organizationId, userId: session.user.id } },
        update: { role: inviteFresh.role },
        create: { organizationId: inviteFresh.organizationId, userId: session.user.id, role: inviteFresh.role, joinedAt: new Date() },
        select: { id: true },
      });

      const existingMeta =
        inviteFresh.metadataJson && typeof inviteFresh.metadataJson === "object"
          ? (inviteFresh.metadataJson as Record<string, unknown>)
          : {};
      await tx.inviteToken.update({
        where: { id: inviteFresh.id },
        data: {
          metadataJson: {
            ...existingMeta,
            usedAt: new Date().toISOString(),
            usedById: session.user.id,
          },
        },
        select: { id: true },
      });
    });

    await setActiveOrganization(session.user.id, invite.organizationId);
    redirect("/dashboard");
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "INVITE_USED") {
      return (
        <div className="flex min-h-dvh items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Invite already used</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">This invite link has already been used.</CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Unable to accept invite</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Unable to accept invite. Please try again.</CardContent>
        </Card>
      </div>
    );
  }
}
