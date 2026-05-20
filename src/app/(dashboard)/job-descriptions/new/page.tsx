import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { createJobDescriptionAction } from "@/app/(dashboard)/job-descriptions/actions";
import { JobDescriptionForm } from "@/features/job-descriptions/job-description-form";

export default async function NewJobDescriptionPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader title="Add job description" description="Create a new job description." />
      <JobDescriptionForm
        mode="create"
        title="Job description details"
        description="Add the role context used for interview prep and evaluation."
        submitLabel="Create job description"
        onSubmitAction={createJobDescriptionAction}
      />
    </div>
  );
}

