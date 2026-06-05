import { notFound, redirect } from "next/navigation";
import type { SeniorityLevel } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { updateCandidateAction } from "@/app/(dashboard)/candidates/actions";
import { CandidateForm } from "@/features/candidates/candidate-form";
import type { CandidateFormInputValues } from "@/features/candidates/candidate-schema";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

type Db = {
  candidate: {
    findFirst: (args: unknown) => Promise<{
      id: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      location: string | null;
      seniorityLevel: SeniorityLevel | null;
      linkedInUrl: string | null;
      githubUrl: string | null;
      resumeFileUrl: string | null;
      resumeFileName: string | null;
      resumeUploadedAt: Date | null;
    } | null>;
  };
};

export default async function EditCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManage = hasPermission(ctx.role, "candidate:manage");

  const { id } = await params;

  const db = prisma as unknown as Db;
  const candidate = await db.candidate.findFirst({
    where: {
      id,
      organizationId: ctx.organization.id,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      location: true,
      seniorityLevel: true,
      linkedInUrl: true,
      githubUrl: true,
      resumeFileUrl: true,
      resumeFileName: true,
      resumeUploadedAt: true,
    },
  });

  if (!candidate) notFound();
  const candidateId = candidate.id;

  async function action(values: CandidateFormInputValues) {
    "use server";
    return updateCandidateAction(candidateId, values);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit candidate" description="Update candidate information." />
      {canManage ? (
        <CandidateForm
          mode="edit"
          title="Candidate details"
          description="Keep candidate information up to date for interviews."
          submitLabel="Save changes"
          existingResume={
            candidate.resumeFileUrl && candidate.resumeFileName
              ? {
                  resumeFileUrl: candidate.resumeFileUrl,
                  resumeFileName: candidate.resumeFileName,
                  resumeUploadedAt: candidate.resumeUploadedAt ? candidate.resumeUploadedAt.toISOString() : null,
                }
              : null
          }
          initialValues={{
            fullName: candidate.fullName,
            email: candidate.email ?? "",
            phone: candidate.phone ?? "",
            location: candidate.location ?? "",
            seniorityLevel: candidate.seniorityLevel ?? undefined,
            linkedInUrl: candidate.linkedInUrl ?? "",
            githubUrl: candidate.githubUrl ?? "",
          }}
          action={action}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">You do not have permission to edit candidates.</CardContent>
        </Card>
      )}
    </div>
  );
}
