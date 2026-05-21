import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DifficultyLevel, QuestionType, SeniorityLevel } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { QuestionTable, type QuestionListRow } from "@/features/question-bank/question-table";
import {
  difficultyOptions,
  questionTypeOptions,
  seniorityOptions,
} from "@/features/question-bank/question-schema";

function asEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    topic?: string;
    difficulty?: string;
    seniorityLevel?: string;
    type?: string;
  }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const params = (await searchParams) ?? {};
  const q = params.q?.trim();
  const topic = params.topic?.trim();

  const difficultyValues = Object.values(DifficultyLevel) as DifficultyLevel[];
  const seniorityValues = Object.values(SeniorityLevel) as SeniorityLevel[];
  const typeValues = Object.values(QuestionType) as QuestionType[];

  const difficulty = asEnum(params.difficulty, difficultyValues);
  const seniorityLevel = asEnum(params.seniorityLevel, seniorityValues);
  const type = asEnum(params.type, typeValues);

  let topics: Array<{ topic: string }> = [];
  let rows: QuestionListRow[] = [];
  let loadError: string | null = null;

  try {
    topics = await prisma.questionBank.findMany({
      distinct: ["topic"],
      orderBy: { topic: "asc" },
      select: { topic: true },
    });
  } catch {
    loadError = "Failed to load questions.";
  }

  try {
    rows = await prisma.questionBank.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { topic: { contains: q, mode: "insensitive" } },
                { prompt: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(topic ? { topic } : {}),
        ...(difficulty ? { difficulty } : {}),
        ...(seniorityLevel ? { seniorityLevel } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        topic: true,
        prompt: true,
        type: true,
        difficulty: true,
        seniorityLevel: true,
        createdAt: true,
      },
    });
  } catch {
    loadError = "Failed to load questions.";
  }

  return (
    <div>
      <PageHeader title="Question Bank" description="Maintain a reusable library of interview questions." />

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form className="flex w-full max-w-md items-center gap-2" action="/question-bank" method="get">
            <Input name="q" placeholder="Search topic or prompt…" defaultValue={q ?? ""} />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/question-bank">Clear</Link>
            </Button>
            <Button asChild>
              <Link href="/question-bank/new">Add Question</Link>
            </Button>
          </div>
        </div>

        <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-4" action="/question-bank" method="get">
          <input type="hidden" name="q" value={q ?? ""} />

          <div className="space-y-1">
            <div className="text-sm font-medium">Topic</div>
            <select
              name="topic"
              defaultValue={topic ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t.topic} value={t.topic}>
                  {t.topic}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Difficulty</div>
            <select
              name="difficulty"
              defaultValue={difficulty ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All</option>
              {difficultyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Seniority</div>
            <select
              name="seniorityLevel"
              defaultValue={seniorityLevel ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All</option>
              {seniorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Type</div>
            <select
              name="type"
              defaultValue={type ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All</option>
              {questionTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <Button type="submit" variant="outline">
              Apply filters
            </Button>
          </div>
        </form>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">No questions yet</div>
              <div className="text-sm text-muted-foreground">
                Add reusable questions to speed up interview preparation.
              </div>
              <div className="pt-2">
                <Button asChild>
                  <Link href="/question-bank/new">Add Question</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <QuestionTable rows={rows} />
      )}
    </div>
  );
}
