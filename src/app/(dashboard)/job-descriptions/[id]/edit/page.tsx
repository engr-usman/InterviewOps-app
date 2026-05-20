import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { updateJobDescriptionAction } from "@/app/(dashboard)/job-descriptions/actions";
import { JobDescriptionForm } from "@/features/job-descriptions/job-description-form";

export default async function EditJobDescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const jd = await prisma.jobDescription.findFirst({
    where: {
      id,
      createdById: session.user.id,
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

  return (
    <div className="space-y-6">
      <PageHeader title="Edit job description" description="Update role context used for interviews." />
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
        onSubmitAction={(values) => updateJobDescriptionAction(jd.id, values)}
      />
    </div>
  );
}

