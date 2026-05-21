"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DifficultyLevel, QuestionType, SourceType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  difficultyOptions,
  questionFormInputSchema,
  questionTypeOptions,
  seniorityOptions,
  sourceTypeOptions,
  type QuestionFormInputValues,
} from "@/features/question-bank/question-schema";

type QuestionFormMode = "create" | "edit";

type QuestionFormProps = {
  mode: QuestionFormMode;
  initialValues?: Partial<QuestionFormInputValues>;
  onSubmitAction: (values: QuestionFormInputValues) => Promise<
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
  onSubmitAction,
  submitLabel,
  title,
  description,
}: QuestionFormProps) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<QuestionFormInputValues>({
    resolver: zodResolver(questionFormInputSchema),
    defaultValues: {
      topic: initialValues?.topic ?? "",
      prompt: initialValues?.prompt ?? "",
      type: initialValues?.type ?? QuestionType.FIXED,
      difficulty: initialValues?.difficulty ?? DifficultyLevel.MID_LEVEL,
      seniorityLevel: initialValues?.seniorityLevel,
      sourceType: initialValues?.sourceType ?? SourceType.MANUAL,
      tags: initialValues?.tags ?? "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await onSubmitAction(values);
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
