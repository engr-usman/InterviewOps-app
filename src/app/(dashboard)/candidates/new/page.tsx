import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCandidateAction } from "@/app/(dashboard)/candidates/actions";
import { CandidateForm } from "@/features/candidates/candidate-form";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

export default async function NewCandidatePage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManage = hasPermission(ctx.role, "candidate:manage");

  return (
    <div className="space-y-6">
      <PageHeader title="Add candidate" description="Create a new candidate record." />
      {canManage ? (
        <CandidateForm
          mode="create"
          title="Candidate details"
          description="Add candidate information and optionally upload a resume."
          submitLabel="Create candidate"
          action={createCandidateAction}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">You do not have permission to create candidates.</CardContent>
        </Card>
      )}
    </div>
  );
}
