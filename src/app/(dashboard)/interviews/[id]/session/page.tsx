import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function InterviewSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const interview = await prisma.interview.findFirst({
    where: { id, createdById: session.user.id },
    select: {
      id: true,
      status: true,
      candidate: { select: { fullName: true } },
      jobDescription: { select: { title: true } },
    },
  });

  if (!interview) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interview session"
        description="Live interview session UI will be implemented in the next step."
      />

      <Card>
        <CardHeader>
          <CardTitle>Session context</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Candidate</div>
            <div>{interview.candidate.fullName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Job description</div>
            <div>{interview.jobDescription.title}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Status</div>
            <div>{interview.status}</div>
          </div>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link href={`/interviews/${interview.id}`}>Back to Interview Detail</Link>
      </Button>
    </div>
  );
}

