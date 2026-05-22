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
import { generateAiInterviewQuestionsAction } from "@/app/(dashboard)/ai/actions";
import {
  aiQuestionStyleValues,
  generateAiQuestionsSchema,
  type GenerateAiQuestionsValues,
} from "@/features/ai/ai-interview-schemas";
import { difficultyOptions, seniorityOptions } from "@/features/question-bank/question-schema";

export function InterviewAiQuestionsManager({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const form = useForm<GenerateAiQuestionsValues>({
    resolver: zodResolver(generateAiQuestionsSchema),
    defaultValues: {
      count: 5,
      focusArea: "",
      difficulty: "",
      seniority: "",
      style: "scenario-based",
    },
  });

  const selectClassName = cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setNotice(null);

    const result = await generateAiInterviewQuestionsAction(interviewId, values);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice(`Created ${result.data.createdCount} AI question(s).`);
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate AI questions</CardTitle>
        <CardDescription>Generate AI-assisted interview questions using candidate + JD context.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="count">Number of questions</Label>
              <Input id="count" type="number" min={1} max={20} {...form.register("count", { valueAsNumber: true })} />
              {form.formState.errors.count?.message ? (
                <p className="text-sm text-destructive">{String(form.formState.errors.count.message)}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="focusArea">Focus area</Label>
              <Input id="focusArea" placeholder="e.g., Kubernetes, incident response, Terraform…" {...form.register("focusArea")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <select id="difficulty" className={selectClassName} {...form.register("difficulty")}>
                <option value="">Auto</option>
                {difficultyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seniority">Seniority</Label>
              <select id="seniority" className={selectClassName} {...form.register("seniority")}>
                <option value="">Auto</option>
                {seniorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="style">Question style</Label>
              <select id="style" className={selectClassName} {...form.register("style")}>
                <option value="">Auto</option>
                {aiQuestionStyleValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Generating..." : "Generate AI Questions"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

