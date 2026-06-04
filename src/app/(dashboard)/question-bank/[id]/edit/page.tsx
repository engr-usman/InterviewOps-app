import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { updateQuestionAction } from "@/app/(dashboard)/question-bank/actions";
import { QuestionForm } from "@/features/question-bank/question-form";
import type { QuestionFormInputValues } from "@/features/question-bank/question-schema";
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
  const canCreate = hasPermission(ctx.role, "questionBank:create");
  const canShareOrganization = canManage;

  const { id } = await params;

  const question = await prisma.questionBank.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: {
      id: true,
      domain: true,
      subDomain: true,
      topic: true,
      prompt: true,
      evaluationGuideText: true,
      visibility: true,
      type: true,
      difficulty: true,
      seniorityLevel: true,
      sourceType: true,
      tagsJson: true,
      createdById: true,
    },
  });

  if (!question) notFound();

  const canEditOwnPrivate = canCreate && question.visibility === "PRIVATE" && question.createdById === session.user.id;
  const canEdit = canManage || canEditOwnPrivate;
  const questionId = question.id;

  async function action(values: QuestionFormInputValues) {
    "use server";
    return updateQuestionAction(questionId, values);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit question" description="Update a question in the shared bank." />
      {canEdit ? (
        <QuestionForm
          mode="edit"
          canShareOrganization={canShareOrganization}
          title="Question details"
          description="Keep questions up to date and reusable across interviews."
          submitLabel="Save changes"
          initialValues={{
            domain: question.domain ?? "Other",
            subDomain: question.subDomain ?? "",
            topic: question.topic,
            prompt: question.prompt,
            evaluationGuideText: question.evaluationGuideText ?? "",
            visibility: question.visibility,
            type: question.type,
            difficulty: question.difficulty,
            seniorityLevel: question.seniorityLevel ?? undefined,
            sourceType: question.sourceType,
            tags: tagsToInput(question.tagsJson),
          }}
          action={action}
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
