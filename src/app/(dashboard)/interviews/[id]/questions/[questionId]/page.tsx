import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

function tagsToString(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const tags = value.filter((t) => typeof t === "string") as string[];
  return tags.join(", ");
}

export default async function InterviewQuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string; questionId: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const { id: interviewId, questionId } = await params;

  const question = await prisma.interviewQuestion.findFirst({
    where: {
      id: questionId,
      interviewId,
      interview: { createdById: session.user.id },
    },
    select: {
      id: true,
      order: true,
      topic: true,
      questionText: true,
      type: true,
      difficulty: true,
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
        <PageHeader title={`Question ${question.order}`} description="Interview question details." />
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/interviews/${interviewId}`}>Back to Interview</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Topic</div>
            <div>{question.topic ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Type</div>
            <div>{question.type}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Difficulty</div>
            <div>{question.difficulty}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-muted-foreground">Tags</div>
            <div>{tags ? tags : "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Question text</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm">{question.questionText}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evaluation</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Evaluation UI will be implemented later.</CardContent>
      </Card>
    </div>
  );
}

