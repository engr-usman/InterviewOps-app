import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createJobDescriptionAction } from "@/app/(dashboard)/job-descriptions/actions";
import { JobDescriptionForm } from "@/features/job-descriptions/job-description-form";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

export default async function NewJobDescriptionPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManage = hasPermission(ctx.role, "jobDescription:manage");

  return (
    <div className="space-y-6">
      <PageHeader title="Add job description" description="Create a new job description." />
      {canManage ? (
        <JobDescriptionForm
          mode="create"
          title="Job description details"
          description="Add the role context used for interview prep and evaluation."
          submitLabel="Create job description"
          onSubmitAction={createJobDescriptionAction}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You do not have permission to create job descriptions.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
