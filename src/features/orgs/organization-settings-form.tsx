"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganizationProfileAction } from "@/app/(dashboard)/settings/organization/actions";

export function OrganizationSettingsForm({
  initialValues,
}: {
  initialValues: {
    name: string;
    website: string | null;
    industry: string | null;
    companySize: string | null;
    logoUrl: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<"name" | "website" | "industry" | "companySize" | "logoUrl", string>>
  >({});

  const [name, setName] = React.useState(initialValues.name);
  const [website, setWebsite] = React.useState(initialValues.website ?? "");
  const [industry, setIndustry] = React.useState(initialValues.industry ?? "");
  const [companySize, setCompanySize] = React.useState(initialValues.companySize ?? "");
  const [logoUrl, setLogoUrl] = React.useState(initialValues.logoUrl ?? "");

  const onSave = () => {
    setError(null);
    setNotice(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateOrganizationProfileAction({
        name,
        website,
        industry,
        companySize,
        logoUrl,
      });
      if (!result.ok) {
        setError(result.fieldErrors && Object.keys(result.fieldErrors).length > 0 ? null : result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setNotice("Organization updated.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      {notice ? <div className="text-sm text-muted-foreground">{notice}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="orgName">Organization name</Label>
          <Input
            id="orgName"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? <div className="text-sm text-destructive">{fieldErrors.name}</div> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="orgWebsite">Website</Label>
          <Input
            id="orgWebsite"
            placeholder="https://company.com"
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              setFieldErrors((prev) => ({ ...prev, website: undefined }));
            }}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.website)}
          />
          <div className="text-sm text-muted-foreground">Must start with http:// or https://</div>
          {fieldErrors.website ? <div className="text-sm text-destructive">{fieldErrors.website}</div> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="orgIndustry">Industry</Label>
          <Input
            id="orgIndustry"
            value={industry}
            onChange={(e) => {
              setIndustry(e.target.value);
              setFieldErrors((prev) => ({ ...prev, industry: undefined }));
            }}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.industry)}
          />
          {fieldErrors.industry ? <div className="text-sm text-destructive">{fieldErrors.industry}</div> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="orgCompanySize">Company size</Label>
          <Input
            id="orgCompanySize"
            value={companySize}
            onChange={(e) => {
              setCompanySize(e.target.value);
              setFieldErrors((prev) => ({ ...prev, companySize: undefined }));
            }}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.companySize)}
          />
          {fieldErrors.companySize ? <div className="text-sm text-destructive">{fieldErrors.companySize}</div> : null}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="orgLogoUrl">Logo URL</Label>
          <Input
            id="orgLogoUrl"
            placeholder="https://company.com/logo.png"
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value);
              setFieldErrors((prev) => ({ ...prev, logoUrl: undefined }));
            }}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.logoUrl)}
          />
          <div className="text-sm text-muted-foreground">
            Optional. Must be a valid image URL starting with http:// or https://
          </div>
          {fieldErrors.logoUrl ? <div className="text-sm text-destructive">{fieldErrors.logoUrl}</div> : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" onClick={onSave} disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
