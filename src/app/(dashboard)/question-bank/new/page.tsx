import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { createQuestionAction } from "@/app/(dashboard)/question-bank/actions";
import { QuestionForm } from "@/features/question-bank/question-form";

export default async function NewQuestionPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader title="Add question" description="Create a new question for the reusable bank." />
      <QuestionForm
        mode="create"
        title="Question details"
        description="Use this library to standardize and speed up interview preparation."
        submitLabel="Create question"
        onSubmitAction={createQuestionAction}
      />
    </div>
  );
}

