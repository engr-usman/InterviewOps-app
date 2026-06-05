"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  candidateFormInputSchema,
  type CandidateFormInputValues,
  seniorityOptions,
} from "@/features/candidates/candidate-schema";

type CandidateFormMode = "create" | "edit";

type CandidateFormProps = {
  mode: CandidateFormMode;
  initialValues?: Partial<CandidateFormInputValues>;
  existingResume?: {
    resumeFileUrl: string;
    resumeFileName: string;
    resumeUploadedAt: string | null;
  } | null;
  action: (values: CandidateFormInputValues) => Promise<
    | { ok: true; data: { id: string } }
    | {
        ok: false;
        message: string;
      }
  >;
  submitLabel: string;
  title: string;
  description: string;
};

export function CandidateForm({
  mode,
  initialValues,
  existingResume,
  action,
  submitLabel,
  title,
  description,
}: CandidateFormProps) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [resumeFile, setResumeFile] = React.useState<File | null>(null);
  const [isUploadingResume, setIsUploadingResume] = React.useState(false);

  const form = useForm<CandidateFormInputValues>({
    resolver: zodResolver(candidateFormInputSchema),
    defaultValues: {
      fullName: initialValues?.fullName ?? "",
      email: initialValues?.email ?? "",
      phone: initialValues?.phone ?? "",
      location: initialValues?.location ?? "",
      seniorityLevel: initialValues?.seniorityLevel,
      linkedInUrl: initialValues?.linkedInUrl ?? "",
      githubUrl: initialValues?.githubUrl ?? "",
    },
  });

  const uploadResume = async (candidateId: string, file: File) => {
    const formData = new FormData();
    formData.append("candidateId", candidateId);
    formData.append("file", file);

    const resp = await fetch("/api/uploads/resumes", { method: "POST", body: formData });
    const json = (await resp.json()) as { ok: boolean; error?: string };
    if (!resp.ok || !json.ok) throw new Error(json.error ?? "Resume upload failed.");
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await action(values);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    if (resumeFile) {
      setIsUploadingResume(true);
      try {
        await uploadResume(result.data.id, resumeFile);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Resume upload failed.");
      } finally {
        setIsUploadingResume(false);
      }
    }

    router.push(`/candidates/${result.data.id}`);
    router.refresh();
  });

  const fieldError = (name: keyof CandidateFormInputValues) =>
    form.formState.errors[name]?.message ? (
      <p className="text-sm text-destructive">{String(form.formState.errors[name]?.message)}</p>
    ) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" autoComplete="name" {...form.register("fullName")} />
              {fieldError("fullName")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
              {fieldError("email")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" autoComplete="tel" {...form.register("phone")} />
              {fieldError("phone")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" autoComplete="address-level2" {...form.register("location")} />
              {fieldError("location")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="seniorityLevel">Seniority level</Label>
              <select
                id="seniorityLevel"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                )}
                {...form.register("seniorityLevel")}
              >
                <option value="">—</option>
                {seniorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldError("seniorityLevel")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedInUrl">LinkedIn URL</Label>
              <Input id="linkedInUrl" type="url" {...form.register("linkedInUrl")} />
              {fieldError("linkedInUrl")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="githubUrl">GitHub URL</Label>
              <Input id="githubUrl" type="url" {...form.register("githubUrl")} />
              {fieldError("githubUrl")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="resumeFile">Resume</Label>
              <Input
                id="resumeFile"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
              />
              {existingResume?.resumeFileUrl ? (
                <p className="text-sm text-muted-foreground">
                  Current:{" "}
                  <a className="text-primary underline-offset-4 hover:underline" href={existingResume.resumeFileUrl}>
                    {existingResume.resumeFileName}
                  </a>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a PDF/DOC/DOCX. Parsing runs after upload.</p>
              )}
            </div>
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting || isUploadingResume}>
              {form.formState.isSubmitting || isUploadingResume ? "Saving..." : submitLabel}
            </Button>
            {mode === "create" ? (
              <Button type="button" variant="outline" onClick={() => router.push("/candidates")}>
                Cancel
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
