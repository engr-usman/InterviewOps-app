"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganizationAction, setActiveOrganizationAction } from "@/app/(onboarding)/onboarding/actions";

export function OnboardingPanel({
  organizations,
  initialMode = "default",
}: {
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
  initialMode?: "default" | "create";
}) {
  const router = useRouter();
  const [orgName, setOrgName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const createInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (initialMode !== "create") return;
    const id = window.setTimeout(() => createInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [initialMode]);

  const onCreate = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const result = await createOrganizationAction({ name: orgName });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const onSelect = async (organizationId: string) => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const result = await setActiveOrganizationAction({ organizationId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Select an organization or create a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

          {organizations.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">Your organizations</div>
              <div className="space-y-2">
                {organizations.map((org) => (
                  <div key={org.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <div className="font-medium">{org.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {org.slug} • {org.role}
                      </div>
                    </div>
                    <Button type="button" variant="outline" onClick={() => onSelect(org.id)} disabled={loading}>
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">No organizations yet.</div>
          )}

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <Label htmlFor="orgName">Create organization</Label>
            <Input
              ref={createInputRef}
              id="orgName"
              placeholder="e.g., Acme Inc"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>

          <Button type="button" onClick={onCreate} disabled={loading}>
            {loading ? "Working..." : "Create Organization"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
