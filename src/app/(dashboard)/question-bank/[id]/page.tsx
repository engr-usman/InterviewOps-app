import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function tagsToString(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const tags = value.filter((t) => typeof t === "string") as string[];
  return tags.join(", ");
}

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canView = hasPermission(ctx.role, "questionBank:view");
  const canManage = hasPermission(ctx.role, "questionBank:manage");
  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Question Bank" description="Question details from the shared library." />
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">You do not have permission to view the Question Bank.</CardContent>
        </Card>
      </div>
    );
  }

  const { id } = await params;

  const question = await prisma.questionBank.findUnique({
    where: { id },
    select: {
      id: true,
      topic: true,
      prompt: true,
      type: true,
      difficulty: true,
      seniorityLevel: true,
      sourceType: true,
      tagsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!question) notFound();

  const tags = tagsToString(question.tagsJson);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={question.topic} description="Question details from the shared library." />
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/question-bank">Back to Question Bank</Link>
          </Button>
          {canManage ? (
            <Button asChild>
              <Link href={`/question-bank/${question.id}/edit`}>Edit Question</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Type</div>
            <div>{question.type}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Difficulty</div>
            <div>{question.difficulty}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Seniority level</div>
            <div>{question.seniorityLevel ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Source type</div>
            <div>{question.sourceType}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div>{formatDateTime(question.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Updated</div>
            <div>{formatDateTime(question.updatedAt)}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-muted-foreground">Tags</div>
            <div>{tags ? tags : "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt / question</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm">{question.prompt}</CardContent>
      </Card>
    </div>
  );
}
