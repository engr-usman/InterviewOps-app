"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganizationByOwnerAction } from "@/app/(dashboard)/settings/organizations/actions";

export function OrganizationEditForm({
  organizationId,
  initialValues,
}: {
  organizationId: string;
  initialValues: {
    name: string;
    slug: string;
    website: string | null;
    industry: string | null;
    companySize: string | null;
    logoUrl: string | null;
  };
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [values, setValues] = React.useState({
    name: initialValues.name,
    slug: initialValues.slug,
    website: initialValues.website ?? "",
    industry: initialValues.industry ?? "",
    companySize: initialValues.companySize ?? "",
    logoUrl: initialValues.logoUrl ?? "",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await updateOrganizationByOwnerAction({
        organizationId,
        name: values.name,
        slug: values.slug,
        website: values.website,
        industry: values.industry,
        companySize: values.companySize,
        logoUrl: values.logoUrl,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/settings/organizations/${result.data.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit organization</CardTitle>
        <CardDescription>Update organization name and profile fields.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={values.slug}
                onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={values.website}
                onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={values.industry}
                onChange={(e) => setValues((v) => ({ ...v, industry: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companySize">Company size</Label>
              <Input
                id="companySize"
                value={values.companySize}
                onChange={(e) => setValues((v) => ({ ...v, companySize: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={values.logoUrl}
                onChange={(e) => setValues((v) => ({ ...v, logoUrl: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
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

