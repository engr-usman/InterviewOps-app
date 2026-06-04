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
  addQuestionSchema,
  generateQuestionsFormSchema,
  type AddQuestionValues,
  type GenerateQuestionsFormValues,
} from "@/features/interviews/interview-question-schema";
import {
  difficultyOptions,
  questionTypeOptions,
  seniorityOptions,
} from "@/features/question-bank/question-schema";
import {
  addInterviewQuestionFromBankAction,
  generateInterviewQuestionsAction,
} from "@/app/(dashboard)/interviews/question-actions";

export type QuestionBankOption = {
  id: string;
  domain: string | null;
  subDomain: string | null;
  topic: string;
  prompt: string;
  type: string;
  difficulty: string;
  seniorityLevel: string | null;
  visibility: "PRIVATE" | "ORGANIZATION";
  createdById: string;
};

function preview(text: string, max = 90) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function InterviewQuestionsManager({
  interviewId,
  topics,
  questionBankOptions,
  currentUserId,
}: {
  interviewId: string;
  topics: string[];
  questionBankOptions: QuestionBankOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [generateNotice, setGenerateNotice] = React.useState<string | null>(null);

  const [addError, setAddError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const generateForm = useForm<GenerateQuestionsFormValues>({
    resolver: zodResolver(generateQuestionsFormSchema),
    defaultValues: {
      count: 8,
      sourceScope: "all",
      topic: "",
      difficulty: "",
      seniorityLevel: "",
      type: "",
    },
  });

  const addForm = useForm<AddQuestionValues>({
    resolver: zodResolver(addQuestionSchema),
    defaultValues: {
      questionBankId: "",
    },
  });

  const sourceScope = (generateForm.watch("sourceScope") || "all") as "all" | "mine" | "shared";

  const scopedOptions = React.useMemo(() => {
    if (sourceScope === "mine") {
      return questionBankOptions.filter((q) => q.visibility === "PRIVATE" && q.createdById === currentUserId);
    }
    if (sourceScope === "shared") {
      return questionBankOptions.filter((q) => q.visibility === "ORGANIZATION");
    }
    return questionBankOptions;
  }, [currentUserId, questionBankOptions, sourceScope]);

  const scopedTopics = React.useMemo(() => {
    const set = new Set(scopedOptions.map((q) => q.topic).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedOptions]);

  const filteredOptions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopedOptions;
    return scopedOptions.filter((opt) => {
      const hay = `${opt.topic} ${opt.prompt} ${opt.type} ${opt.difficulty}`.toLowerCase();
      return hay.includes(q);
    });
  }, [scopedOptions, search]);

  const onGenerate = generateForm.handleSubmit(async (values) => {
    setGenerateError(null);
    setGenerateNotice(null);

    const result = await generateInterviewQuestionsAction(interviewId, values);
    if (!result.ok) {
      setGenerateError(result.error);
      return;
    }

    if (result.data.createdCount === 0) {
      setGenerateNotice("No matching questions were found (or they are already added).");
    } else {
      setGenerateNotice(`Added ${result.data.createdCount} question(s) to this interview.`);
    }

    router.refresh();
  });

  const onAdd = addForm.handleSubmit(async (values) => {
    setAddError(null);
    const result = await addInterviewQuestionFromBankAction(interviewId, values);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    addForm.reset({ questionBankId: "" });
    router.refresh();
  });

  const selectClassName = cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Add questions from bank</CardTitle>
          <CardDescription>Generate a fixed set from existing Question Bank records.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onGenerate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sourceScope">Question source</Label>
                <select id="sourceScope" className={selectClassName} {...generateForm.register("sourceScope")}>
                  <option value="all">All available</option>
                  <option value="mine">My questions</option>
                  <option value="shared">Shared questions</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">Number of questions</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={20}
                  {...generateForm.register("count", { valueAsNumber: true })}
                />
                {generateForm.formState.errors.count?.message ? (
                  <p className="text-sm text-destructive">{String(generateForm.formState.errors.count?.message)}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <select id="topic" className={selectClassName} {...generateForm.register("topic")}>
                  <option value="">All topics</option>
                  {(scopedTopics.length > 0 ? scopedTopics : topics).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <select id="difficulty" className={selectClassName} {...generateForm.register("difficulty")}>
                  <option value="">All</option>
                  {difficultyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seniorityLevel">Seniority level</Label>
                <select id="seniorityLevel" className={selectClassName} {...generateForm.register("seniorityLevel")}>
                  <option value="">All</option>
                  {seniorityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="type">Question type</Label>
                <select id="type" className={selectClassName} {...generateForm.register("type")}>
                  <option value="">All</option>
                  {questionTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {generateError ? <p className="text-sm text-destructive">{generateError}</p> : null}
            {generateNotice ? <p className="text-sm text-muted-foreground">{generateNotice}</p> : null}

            <Button type="submit" disabled={generateForm.formState.isSubmitting}>
              {generateForm.formState.isSubmitting ? "Generating..." : "Generate Question Set"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual add</CardTitle>
          <CardDescription>Add a specific Question Bank record to this interview.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sourceScopeManual">Question source</Label>
              <select
                id="sourceScopeManual"
                className={selectClassName}
                value={sourceScope}
                onChange={(e) => {
                  generateForm.setValue("sourceScope", e.target.value as "all" | "mine" | "shared");
                }}
              >
                <option value="all">All available</option>
                <option value="mine">My questions</option>
                <option value="shared">Shared questions</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search topic or prompt…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="questionBankId">Question</Label>
              <select id="questionBankId" className={selectClassName} {...addForm.register("questionBankId")}>
                <option value="">Select a question</option>
                {filteredOptions.slice(0, 200).map((q) => (
                  <option key={q.id} value={q.id}>
                    {(q.domain || q.subDomain) && q.domain ? `${q.domain} — ` : ""}
                    {q.subDomain ? `${q.subDomain} — ` : ""}
                    {q.topic} — {preview(q.prompt)}
                  </option>
                ))}
              </select>
              {addForm.formState.errors.questionBankId?.message ? (
                <p className="text-sm text-destructive">
                  {String(addForm.formState.errors.questionBankId?.message)}
                </p>
              ) : null}
            </div>

            {addError ? <p className="text-sm text-destructive">{addError}</p> : null}

            <Button type="submit" disabled={addForm.formState.isSubmitting}>
              {addForm.formState.isSubmitting ? "Adding..." : "Add to Interview"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
