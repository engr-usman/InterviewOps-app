"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InterviewStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  interviewFormInputSchema,
  statusOptions,
  type InterviewFormInputValues,
} from "@/features/interviews/interview-schema";

type InterviewFormMode = "create" | "edit";

export type CandidateOption = { id: string; fullName: string };
export type JobDescriptionOption = { id: string; title: string };

type InterviewFormProps = {
  mode: InterviewFormMode;
  candidates: CandidateOption[];
  jobDescriptions: JobDescriptionOption[];
  initialValues?: Partial<InterviewFormInputValues>;
  action: (values: InterviewFormInputValues) => Promise<
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

export function InterviewForm({
  mode,
  candidates,
  jobDescriptions,
  initialValues,
  action,
  submitLabel,
  title,
  description,
}: InterviewFormProps) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<InterviewFormInputValues>({
    resolver: zodResolver(interviewFormInputSchema),
    defaultValues: {
      candidateId: initialValues?.candidateId ?? "",
      jobDescriptionId: initialValues?.jobDescriptionId ?? "",
      status: initialValues?.status ?? InterviewStatus.DRAFT,
      scheduledStartAt: initialValues?.scheduledStartAt ?? "",
      scheduledEndAt: initialValues?.scheduledEndAt ?? "",
      meetingUrl: initialValues?.meetingUrl ?? "",
      notesText: initialValues?.notesText ?? "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await action(values);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    router.push(`/interviews/${result.data.id}`);
    router.refresh();
  });

  const fieldError = (name: keyof InterviewFormInputValues) =>
    form.formState.errors[name]?.message ? (
      <p className="text-sm text-destructive">{String(form.formState.errors[name]?.message)}</p>
    ) : null;

  const noCandidates = candidates.length === 0;
  const noJobDescriptions = jobDescriptions.length === 0;

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
              <Label htmlFor="candidateId">Candidate</Label>
              <select
                id="candidateId"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                )}
                disabled={noCandidates}
                {...form.register("candidateId")}
              >
                <option value="">{noCandidates ? "No candidates available" : "Select candidate"}</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
              {fieldError("candidateId")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobDescriptionId">Job description</Label>
              <select
                id="jobDescriptionId"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                )}
                disabled={noJobDescriptions}
                {...form.register("jobDescriptionId")}
              >
                <option value="">
                  {noJobDescriptions ? "No job descriptions available" : "Select job description"}
                </option>
                {jobDescriptions.map((jd) => (
                  <option key={jd.id} value={jd.id}>
                    {jd.title}
                  </option>
                ))}
              </select>
              {fieldError("jobDescriptionId")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                {...form.register("status")}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldError("status")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledStartAt">Scheduled start</Label>
              <Input
                id="scheduledStartAt"
                type="datetime-local"
                {...form.register("scheduledStartAt")}
              />
              {fieldError("scheduledStartAt")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledEndAt">Scheduled end</Label>
              <Input
                id="scheduledEndAt"
                type="datetime-local"
                {...form.register("scheduledEndAt")}
              />
              {fieldError("scheduledEndAt")}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="meetingUrl">Meeting URL</Label>
              <Input id="meetingUrl" type="url" placeholder="https://…" {...form.register("meetingUrl")} />
              {fieldError("meetingUrl")}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notesText">Notes</Label>
              <textarea
                id="notesText"
                className={cn(
                  "min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                {...form.register("notesText")}
              />
              {fieldError("notesText")}
            </div>
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting || noCandidates || noJobDescriptions}>
              {form.formState.isSubmitting ? "Saving..." : submitLabel}
            </Button>
            {mode === "create" ? (
              <Button type="button" variant="outline" onClick={() => router.push("/interviews")}>
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
