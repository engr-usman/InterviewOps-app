"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DifficultyLevel, QuestionType, SourceType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  difficultyOptions,
  domainOptions,
  questionFormInputSchema,
  questionTypeOptions,
  seniorityOptions,
  subDomainsByDomain,
  sourceTypeOptions,
  visibilityOptions,
  type QuestionFormInputValues,
} from "@/features/question-bank/question-schema";

type QuestionFormMode = "create" | "edit";

type QuestionFormProps = {
  mode: QuestionFormMode;
  initialValues?: Partial<QuestionFormInputValues>;
  canShareOrganization: boolean;
  action: (values: QuestionFormInputValues) => Promise<
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

export function QuestionForm({
  mode,
  initialValues,
  canShareOrganization,
  action,
  submitLabel,
  title,
  description,
}: QuestionFormProps) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<QuestionFormInputValues>({
    resolver: zodResolver(questionFormInputSchema),
    defaultValues: {
      domain: initialValues?.domain ?? "Other",
      subDomain: initialValues?.subDomain ?? "",
      topic: initialValues?.topic ?? "",
      prompt: initialValues?.prompt ?? "",
      evaluationGuideText: initialValues?.evaluationGuideText ?? "",
      type: initialValues?.type ?? QuestionType.FIXED,
      difficulty: initialValues?.difficulty ?? DifficultyLevel.MID_LEVEL,
      seniorityLevel: initialValues?.seniorityLevel,
      sourceType: initialValues?.sourceType ?? SourceType.MANUAL,
      tags: initialValues?.tags ?? "",
      visibility: initialValues?.visibility ?? "PRIVATE",
    },
  });

  const selectedDomain = (useWatch({ control: form.control, name: "domain" }) ?? "") as keyof typeof subDomainsByDomain | "";
  const availableSubDomains = selectedDomain && selectedDomain in subDomainsByDomain ? subDomainsByDomain[selectedDomain] : [];
  const visibility = (useWatch({ control: form.control, name: "visibility" }) ?? "PRIVATE") as "PRIVATE" | "ORGANIZATION";

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    if (!canShareOrganization && values.visibility === "ORGANIZATION") {
      setFormError("You do not have permission to share questions with the organization.");
      return;
    }
    const result = await action(values);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.push(`/question-bank/${result.data.id}`);
    router.refresh();
  });

  const fieldError = (name: keyof QuestionFormInputValues) =>
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
              <Label htmlFor="domain">Domain</Label>
              <select
                id="domain"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                {...form.register("domain")}
              >
                <option value="">—</option>
                {domainOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {fieldError("domain")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subDomain">Sub-domain</Label>
              <select
                id="subDomain"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                disabled={availableSubDomains.length === 0}
                {...form.register("subDomain")}
              >
                <option value="">—</option>
                {availableSubDomains.map((sd) => (
                  <option key={sd} value={sd}>
                    {sd}
                  </option>
                ))}
              </select>
              {fieldError("subDomain")}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" {...form.register("topic")} />
              {fieldError("topic")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                {...form.register("type")}
              >
                {questionTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldError("type")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <select
                id="difficulty"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                {...form.register("difficulty")}
              >
                {difficultyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldError("difficulty")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="seniorityLevel">Seniority level</Label>
              <select
                id="seniorityLevel"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
              <Label htmlFor="sourceType">Source type</Label>
              <select
                id="sourceType"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                {...form.register("sourceType")}
              >
                {sourceTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldError("sourceType")}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="prompt">Prompt / question</Label>
              <textarea
                id="prompt"
                className={cn(
                  "min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                {...form.register("prompt")}
              />
              {fieldError("prompt")}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="evaluationGuideText">Expected answer / evaluation guide</Label>
              <textarea
                id="evaluationGuideText"
                className={cn(
                  "min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                {...form.register("evaluationGuideText")}
              />
              {fieldError("evaluationGuideText")}
            </div>

            {canShareOrganization ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="visibility">Visibility</Label>
                <select
                  id="visibility"
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                  {...form.register("visibility")}
                >
                  {visibilityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  {visibility === "ORGANIZATION"
                    ? "Shared questions can be used by other interviewers in this organization."
                    : "Private questions are only visible to you. You can use them in your assigned interviews."}
                </p>
                {fieldError("visibility")}
              </div>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <div className="text-sm font-medium">Visibility</div>
                <div className="text-sm text-muted-foreground">
                  Private questions are only visible to you. You can use them in your assigned interviews.
                </div>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" placeholder="e.g. kubernetes, scheduling, sre" {...form.register("tags")} />
              <p className="text-sm text-muted-foreground">
                Comma-separated. Stored as an array in tagsJson.
              </p>
              {fieldError("tags")}
            </div>
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : submitLabel}
            </Button>
            {mode === "create" ? (
              <Button type="button" variant="outline" onClick={() => router.push("/question-bank")}>
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
