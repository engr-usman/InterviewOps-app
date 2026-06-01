import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { updateQuestionAction } from "@/app/(dashboard)/question-bank/actions";
import { QuestionForm } from "@/features/question-bank/question-form";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

function tagsToInput(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const tags = value.filter((t) => typeof t === "string") as string[];
  return tags.join(", ");
}

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManage = hasPermission(ctx.role, "questionBank:manage");

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
    },
  });

  if (!question) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit question" description="Update a question in the shared bank." />
      {canManage ? (
        <QuestionForm
          mode="edit"
          title="Question details"
          description="Keep questions up to date and reusable across interviews."
          submitLabel="Save changes"
          initialValues={{
            topic: question.topic,
            prompt: question.prompt,
            type: question.type,
            difficulty: question.difficulty,
            seniorityLevel: question.seniorityLevel ?? undefined,
            sourceType: question.sourceType,
            tags: tagsToInput(question.tagsJson),
          }}
          onSubmitAction={(values) => updateQuestionAction(question.id, values)}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">You do not have permission to edit questions.</CardContent>
        </Card>
      )}
    </div>
  );
}
