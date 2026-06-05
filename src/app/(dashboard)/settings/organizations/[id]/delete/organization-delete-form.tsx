"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteOrganizationByOwnerAction } from "@/app/(dashboard)/settings/organizations/actions";

export function OrganizationDeleteForm({
  organizationId,
  organizationName,
  organizationSlug,
}: {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
}) {
  const router = useRouter();
  const [confirmationText, setConfirmationText] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const typed = confirmationText.trim();
  const matches = typed === organizationSlug || typed === organizationName;
  const canDelete = matches && confirmed && !loading;

  const onDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await deleteOrganizationByOwnerAction({
        organizationId,
        confirmationText,
        confirmed,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/settings/organizations");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete organization</CardTitle>
        <CardDescription>
          This will permanently delete this organization and related workspace data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="font-medium">Danger zone</div>
          <div className="mt-1 text-muted-foreground">
            Organization: <span className="font-medium text-foreground">{organizationName}</span> (
            <span className="font-medium text-foreground">{organizationSlug}</span>)
          </div>
        </div>

        <form onSubmit={onDelete} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirmText">
              Type the organization slug or name to confirm
            </Label>
            <Input
              id="confirmText"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              disabled={loading}
            />
            <div className="text-xs text-muted-foreground">
              Accepted: <span className="font-medium">{organizationSlug}</span> or{" "}
              <span className="font-medium">{organizationName}</span>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={loading}
              className="mt-1"
            />
            <span>I understand this action cannot be undone.</span>
          </label>

          <div className="flex items-center gap-2">
            <Button type="submit" variant="destructive" disabled={!canDelete}>
              {loading ? "Deleting..." : "Delete Organization"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

