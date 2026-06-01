"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createInviteTokenAction, removeMemberAction, updateMemberRoleAction } from "@/app/(dashboard)/settings/team/actions";
import { orgRoleValues, type OrgRole } from "@/server/services/rbac";

export function TeamManagement({
  organizationName,
  organizationSlug,
  planCode,
  members,
}: {
  organizationName: string;
  organizationSlug: string;
  planCode: string;
  members: Array<{ id: string; userEmail: string; userName: string | null; role: OrgRole; joinedAt: string }>;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<OrgRole>("VIEWER");
  const [inviteData, setInviteData] = React.useState<{
    inviteUrl: string;
    email: string;
    role: OrgRole;
    expiresAt: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);

  const selectClassName = cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  );

  const onInvite = async () => {
    setError(null);
    setNotice(null);
    setInviteData(null);
    setLoading(true);
    try {
      const result = await createInviteTokenAction({ email: inviteEmail, role: inviteRole });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setInviteData(result.data);
      setNotice("Invite link created. Share it with the member.");
    } finally {
      setLoading(false);
    }
  };

  const onCopyInviteLink = async () => {
    if (!inviteData) return;
    try {
      await navigator.clipboard.writeText(inviteData.inviteUrl);
      setNotice("Invite link copied.");
    } catch {
      setError("Unable to copy link. Please copy it manually.");
    }
  };

  const onChangeRole = async (memberId: string, role: OrgRole) => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const result = await updateMemberRoleAction({ memberId, role });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice("Role updated.");
    } finally {
      setLoading(false);
    }
  };

  const onRemove = async (memberId: string) => {
    const ok = window.confirm("Remove this member from the organization?");
    if (!ok) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const result = await removeMemberAction({ memberId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice("Member removed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-muted-foreground">Organization</div>
            <div className="font-medium">{organizationName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Slug</div>
            <div className="font-medium">{organizationSlug}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Plan</div>
            <div className="font-medium">{planCode}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="text-sm font-medium">Invite member</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="inviteEmail">Email</Label>
            <Input id="inviteEmail" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@company.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteRole">Role</Label>
            <select id="inviteRole" className={selectClassName} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)}>
              {orgRoleValues.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button type="button" onClick={onInvite} disabled={loading}>
            {loading ? "Working..." : "Create Invite Link"}
          </Button>
        </div>
        {inviteData ? (
          <div className="mt-3 space-y-2 rounded-md bg-muted p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-muted-foreground">Invite URL</div>
              <Button type="button" variant="outline" size="sm" onClick={onCopyInviteLink} disabled={loading}>
                Copy link
              </Button>
            </div>
            <div className="break-all">{inviteData.inviteUrl}</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground">Invited email</div>
                <div className="font-medium">{inviteData.email}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Role</div>
                <div className="font-medium">{inviteData.role}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Expiry</div>
                <div className="font-medium">{new Date(inviteData.expiresAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

      <div className="rounded-lg border">
        <div className="border-b p-4 text-sm font-medium">Members</div>
        <div className="divide-y">
          {members.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No members.</div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{m.userName ?? m.userEmail}</div>
                  <div className="text-sm text-muted-foreground">{m.userEmail}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select className={selectClassName} value={m.role} onChange={(e) => onChangeRole(m.id, e.target.value as OrgRole)} disabled={loading}>
                    {orgRoleValues.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" onClick={() => onRemove(m.id)} disabled={loading}>
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
