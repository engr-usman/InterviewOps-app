import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DifficultyLevel, QuestionType, SeniorityLevel } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { QuestionTable, type QuestionListRow } from "@/features/question-bank/question-table";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { canCreateQuestionBankQuestions, hasPermission } from "@/server/services/rbac";
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

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canView = hasPermission(ctx.role, "questionBank:view");
  const canManage = hasPermission(ctx.role, "questionBank:manage");
  const canCreate = canCreateQuestionBankQuestions(ctx.role);
  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Question Bank" description="Maintain a reusable library of interview questions." />
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">You do not have permission to view the Question Bank.</CardContent>
        </Card>
      </div>
    );
  }

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
  let analytics: {
    mostUsed: Array<{ id: string; topic: string; prompt: string; uses: number; avgScore: number | null; evaluated: number }>;
    highestScoring: Array<{ id: string; topic: string; prompt: string; avgScore: number }>;
    hardest: Array<{ id: string; topic: string; prompt: string; avgScore: number }>;
    mostSkipped: Array<{ id: string; topic: string; prompt: string; skipRatePct: number; uses: number }>;
    typeUsage: Array<{ type: string; count: number }>;
  } | null = null;
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

  try {
    const interviewQuestions = await prisma.interviewQuestion.findMany({
      where: { interview: { organizationId: ctx.organization.id }, questionBankId: { not: null } },
      select: {
        questionBankId: true,
        evaluation: { select: { score: true } },
        questionBank: { select: { id: true, topic: true, prompt: true } },
      },
      take: 4000,
      orderBy: { createdAt: "desc" },
    });

    const typeUsageRaw = await prisma.interviewQuestion.groupBy({
      by: ["type"],
      where: { interview: { organizationId: ctx.organization.id } },
      _count: { _all: true },
    });

    const map = new Map<
      string,
      { id: string; topic: string; prompt: string; uses: number; scoreSum: number; scoreCount: number }
    >();

    for (const q of interviewQuestions) {
      if (!q.questionBankId || !q.questionBank) continue;
      const key = q.questionBankId;
      const cur =
        map.get(key) ?? {
          id: q.questionBank.id,
          topic: q.questionBank.topic,
          prompt: q.questionBank.prompt,
          uses: 0,
          scoreSum: 0,
          scoreCount: 0,
        };
      cur.uses += 1;
      if (typeof q.evaluation?.score === "number") {
        cur.scoreSum += q.evaluation.score;
        cur.scoreCount += 1;
      }
      map.set(key, cur);
    }

    const all = Array.from(map.values()).map((v) => ({
      ...v,
      evaluated: v.scoreCount,
      avgScore: v.scoreCount === 0 ? null : Math.round((v.scoreSum / v.scoreCount) * 100) / 100,
    }));

    const mostUsed = all
      .slice()
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 8);

    const highestScoring = all
      .filter((a) => typeof a.avgScore === "number")
      .slice()
      .sort((a, b) => (b.avgScore as number) - (a.avgScore as number))
      .slice(0, 8)
      .map((a) => ({ id: a.id, topic: a.topic, prompt: a.prompt, avgScore: a.avgScore as number }));

    const hardest = all
      .filter((a) => typeof a.avgScore === "number")
      .slice()
      .sort((a, b) => (a.avgScore as number) - (b.avgScore as number))
      .slice(0, 8)
      .map((a) => ({ id: a.id, topic: a.topic, prompt: a.prompt, avgScore: a.avgScore as number }));

    const mostSkipped = all
      .filter((a) => a.uses >= 2)
      .slice()
      .map((a) => ({
        id: a.id,
        topic: a.topic,
        prompt: a.prompt,
        uses: a.uses,
        skipRatePct: Math.round(((a.uses - a.evaluated) / Math.max(1, a.uses)) * 100),
      }))
      .sort((a, b) => b.skipRatePct - a.skipRatePct)
      .slice(0, 8);

    analytics = {
      mostUsed,
      highestScoring,
      hardest,
      mostSkipped,
      typeUsage: typeUsageRaw.map((t) => ({ type: String(t.type), count: t._count._all })),
    };
  } catch {
    analytics = null;
  }

  return (
    <div>
      <PageHeader title="Question Bank" description="Maintain a reusable library of interview questions." />

      {analytics ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6 text-sm">
              <div className="text-sm font-medium">Usage overview</div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {analytics.typeUsage.map((t) => (
                  <div key={t.type} className="rounded-md border p-3">
                    <div className="text-muted-foreground">{t.type}</div>
                    <div className="text-lg font-semibold">{t.count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-sm">
              <div className="text-sm font-medium">Most used questions (top 8)</div>
              <div className="mt-2 space-y-2">
                {analytics.mostUsed.length === 0 ? (
                  <div className="text-muted-foreground">No usage yet.</div>
                ) : (
                  analytics.mostUsed.map((q) => (
                    <div key={q.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium">{q.topic}</div>
                        <div className="truncate text-muted-foreground">{q.prompt}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground">{q.uses}</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

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
            {canCreate ? (
              <Button asChild>
                <Link href="/question-bank/new">Add Question</Link>
              </Button>
            ) : null}
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
              {canCreate ? (
                <div className="pt-2">
                  <Button asChild>
                    <Link href="/question-bank/new">Add Question</Link>
                  </Button>
                </div>
              ) : (
                <div className="pt-2 text-sm text-muted-foreground">Ask an admin to add questions.</div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <QuestionTable rows={rows} canManage={canManage} />
      )}
    </div>
  );
}
