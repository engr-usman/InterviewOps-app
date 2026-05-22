import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { createCandidateAction } from "@/app/(dashboard)/candidates/actions";
import { CandidateForm } from "@/features/candidates/candidate-form";

export default async function NewCandidatePage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader title="Add candidate" description="Create a new candidate record." />
      <CandidateForm
        mode="create"
        title="Candidate details"
        description="Add candidate information and optionally upload a resume."
        submitLabel="Create candidate"
        onSubmitAction={createCandidateAction}
      />
    </div>
  );
}
