import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { InterviewSessionConsole } from "@/features/interviews/interview-session-console";

export default async function InterviewSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const interview = await prisma.interview.findFirst({
    where: { id, createdById: session.user.id },
    select: {
      id: true,
      status: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
          email: true,
          seniorityLevel: true,
        },
      },
      jobDescription: {
        select: {
          id: true,
          title: true,
          seniorityLevel: true,
        },
      },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          topic: true,
          questionText: true,
          type: true,
          difficulty: true,
          tagsJson: true,
          evaluation: {
            select: {
              id: true,
              score: true,
              notesText: true,
              metadataJson: true,
              updatedAt: true,
            },
          },
        },
      },
      scorecard: {
        select: {
          id: true,
          recommendation: true,
          overallScore: true,
          summaryText: true,
          scorecardJson: true,
        },
      },
    },
  });

  if (!interview) notFound();

  return (
    <InterviewSessionConsole
      interviewId={interview.id}
      interviewStatus={interview.status}
      candidate={interview.candidate}
      jobDescription={interview.jobDescription}
      questions={interview.questions.map((q) => ({
        ...q,
        evaluation: q.evaluation
          ? { ...q.evaluation, updatedAt: q.evaluation.updatedAt.toISOString() }
          : null,
      }))}
      scorecard={interview.scorecard ?? null}
    />
  );
}
