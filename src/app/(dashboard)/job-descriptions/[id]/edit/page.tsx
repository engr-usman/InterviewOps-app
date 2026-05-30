import { notFound, redirect } from "next/navigation";
import type { SeniorityLevel } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { updateJobDescriptionAction } from "@/app/(dashboard)/job-descriptions/actions";
import { JobDescriptionForm } from "@/features/job-descriptions/job-description-form";
import type { JobDescriptionFormInputValues } from "@/features/job-descriptions/job-description-schema";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

type Db = {
  jobDescription: {
    findFirst: (args: unknown) => Promise<{
      id: string;
      title: string;
      department: string | null;
      location: string | null;
      seniorityLevel: SeniorityLevel | null;
      descriptionText: string | null;
      requirementsText: string | null;
    } | null>;
  };
};

export default async function EditJobDescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManage = hasPermission(ctx.role, "jobDescription:manage");

  const { id } = await params;

  const db = prisma as unknown as Db;
  const jd = await db.jobDescription.findFirst({
    where: {
      id,
      organizationId: ctx.organization.id,
    },
    select: {
      id: true,
      title: true,
      department: true,
      location: true,
      seniorityLevel: true,
      descriptionText: true,
      requirementsText: true,
    },
  });

  if (!jd) notFound();
  const jdId = jd.id;

  async function action(values: JobDescriptionFormInputValues) {
    "use server";
    return updateJobDescriptionAction(jdId, values);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit job description" description="Update role context used for interviews." />
      {canManage ? (
        <JobDescriptionForm
          mode="edit"
          title="Job description details"
          description="Keep this job description up to date as the role evolves."
          submitLabel="Save changes"
          initialValues={{
            title: jd.title,
            department: jd.department ?? "",
            location: jd.location ?? "",
            seniorityLevel: jd.seniorityLevel ?? undefined,
            descriptionText: jd.descriptionText ?? "",
            requirementsText: jd.requirementsText ?? "",
          }}
          action={action}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You do not have permission to edit job descriptions.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
