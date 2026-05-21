import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { updateInterviewAction } from "@/app/(dashboard)/interviews/actions";
import { InterviewForm } from "@/features/interviews/interview-form";

function toDatetimeLocalValue(date: Date | null) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export default async function EditInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const interview = await prisma.interview.findFirst({
    where: { id, createdById: session.user.id },
    select: {
      id: true,
      candidateId: true,
      jobDescriptionId: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      meetingUrl: true,
      notesText: true,
    },
  });

  if (!interview) notFound();

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
      <PageHeader title="Edit interview" description="Update interview details and scheduling." />
      <InterviewForm
        mode="edit"
        title="Interview details"
        description="Update scheduling, links, and status."
        submitLabel="Save changes"
        candidates={candidates}
        jobDescriptions={jobDescriptions}
        initialValues={{
          candidateId: interview.candidateId,
          jobDescriptionId: interview.jobDescriptionId,
          status: interview.status,
          scheduledStartAt: toDatetimeLocalValue(interview.scheduledStartAt),
          scheduledEndAt: toDatetimeLocalValue(interview.scheduledEndAt),
          meetingUrl: interview.meetingUrl ?? "",
          notesText: interview.notesText ?? "",
        }}
        onSubmitAction={(values) => updateInterviewAction(interview.id, values)}
      />
    </div>
  );
}

