import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createQuestionAction } from "@/app/(dashboard)/question-bank/actions";
import { QuestionForm } from "@/features/question-bank/question-form";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { canCreateQuestionBankQuestions, hasPermission } from "@/server/services/rbac";

export default async function NewQuestionPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canCreate = canCreateQuestionBankQuestions(ctx.role);
  const canShareOrganization = hasPermission(ctx.role, "questionBank:manage");

  return (
    <div className="space-y-6">
      <PageHeader title="Add question" description="Create a new question for the reusable bank." />
      {canCreate ? (
        <QuestionForm
          mode="create"
          canShareOrganization={canShareOrganization}
          title="Question details"
          description="Use this library to standardize and speed up interview preparation."
          submitLabel="Create question"
          action={createQuestionAction}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">You do not have permission to create questions.</CardContent>
        </Card>
      )}
    </div>
  );
}
