import { redirect } from "next/navigation";
import { InterviewStatus } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { createInterviewAction } from "@/app/(dashboard)/interviews/actions";
import { InterviewForm } from "@/features/interviews/interview-form";

export default async function NewInterviewPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const candidates = await prisma.candidate.findMany({
    where: { createdById: session.user.id },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  const jobDescriptions = await prisma.jobDescription.findMany({
    where: { createdById: session.user.id },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Create interview" description="Link a candidate to a job description." />
      <InterviewForm
        mode="create"
        title="Interview details"
        description="You can schedule times and add meeting details now. Live session UI comes next."
        submitLabel="Create interview"
        candidates={candidates}
        jobDescriptions={jobDescriptions}
        initialValues={{
          status: InterviewStatus.DRAFT,
        }}
        onSubmitAction={createInterviewAction}
      />
    </div>
  );
}

