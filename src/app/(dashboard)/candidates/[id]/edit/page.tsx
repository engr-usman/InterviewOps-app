import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { updateCandidateAction } from "@/app/(dashboard)/candidates/actions";
import { CandidateForm } from "@/features/candidates/candidate-form";

export default async function EditCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const candidate = await prisma.candidate.findFirst({
    where: {
      id,
      createdById: session.user.id,
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
    },
  });

  if (!candidate) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit candidate" description="Update candidate information." />
      <CandidateForm
        mode="edit"
        title="Candidate details"
        description="Keep candidate information up to date for interviews."
        submitLabel="Save changes"
        initialValues={{
          fullName: candidate.fullName,
          email: candidate.email ?? "",
          phone: candidate.phone ?? "",
          location: candidate.location ?? "",
          seniorityLevel: candidate.seniorityLevel ?? undefined,
          linkedInUrl: candidate.linkedInUrl ?? "",
          githubUrl: candidate.githubUrl ?? "",
        }}
        onSubmitAction={(values) => updateCandidateAction(candidate.id, values)}
      />
    </div>
  );
}

