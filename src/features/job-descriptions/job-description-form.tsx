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
  jobDescriptionFormInputSchema,
  type JobDescriptionFormInputValues,
  seniorityOptions,
} from "@/features/job-descriptions/job-description-schema";

type JobDescriptionFormMode = "create" | "edit";

type JobDescriptionFormProps = {
  mode: JobDescriptionFormMode;
  initialValues?: Partial<JobDescriptionFormInputValues>;
  onSubmitAction: (values: JobDescriptionFormInputValues) => Promise<
    | { ok: true; data: { id: string } }
    | {
        ok: false;
        error: string;
      }
  >;
  submitLabel: string;
  title: string;
  description: string;
};

export function JobDescriptionForm({
  mode,
  initialValues,
  onSubmitAction,
  submitLabel,
  title,
  description,
}: JobDescriptionFormProps) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<JobDescriptionFormInputValues>({
    resolver: zodResolver(jobDescriptionFormInputSchema),
    defaultValues: {
      title: initialValues?.title ?? "",
      department: initialValues?.department ?? "",
      location: initialValues?.location ?? "",
      seniorityLevel: initialValues?.seniorityLevel,
      descriptionText: initialValues?.descriptionText ?? "",
      requirementsText: initialValues?.requirementsText ?? "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await onSubmitAction(values);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.push(`/job-descriptions/${result.data.id}`);
    router.refresh();
  });

  const fieldError = (name: keyof JobDescriptionFormInputValues) =>
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...form.register("title")} />
              {fieldError("title")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input id="department" {...form.register("department")} />
              {fieldError("department")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...form.register("location")} />
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

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="descriptionText">Description</Label>
              <textarea
                id="descriptionText"
                className={cn(
                  "min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                {...form.register("descriptionText")}
              />
              {fieldError("descriptionText")}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="requirementsText">Requirements</Label>
              <textarea
                id="requirementsText"
                className={cn(
                  "min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                {...form.register("requirementsText")}
              />
              {fieldError("requirementsText")}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" disabled placeholder="Tags will be enabled in a later MVP iteration." />
              <p className="text-sm text-muted-foreground">Tags are stored in tagsJson and will be wired up later.</p>
            </div>
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : submitLabel}
            </Button>
            {mode === "create" ? (
              <Button type="button" variant="outline" onClick={() => router.push("/job-descriptions")}>
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
