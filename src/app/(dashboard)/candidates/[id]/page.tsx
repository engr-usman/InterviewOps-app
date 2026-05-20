import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
      resumeFileName: true,
      resumeMimeType: true,
      resumeUploadedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!candidate) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={candidate.fullName} description="Candidate profile and interview context." />
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/candidates">Back to Candidates</Link>
          </Button>
          <Button asChild>
            <Link href={`/candidates/${candidate.id}/edit`}>Edit Candidate</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Candidate information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Email</div>
            <div>{candidate.email ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Phone</div>
            <div>{candidate.phone ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Location</div>
            <div>{candidate.location ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Seniority level</div>
            <div>{candidate.seniorityLevel ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">LinkedIn</div>
            <div>
              {candidate.linkedInUrl ? (
                <a className="text-primary underline-offset-4 hover:underline" href={candidate.linkedInUrl}>
                  {candidate.linkedInUrl}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">GitHub</div>
            <div>
              {candidate.githubUrl ? (
                <a className="text-primary underline-offset-4 hover:underline" href={candidate.githubUrl}>
                  {candidate.githubUrl}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div>{formatDateTime(candidate.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Updated</div>
            <div>{formatDateTime(candidate.updatedAt)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resume</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-muted-foreground">File name</div>
              <div>{candidate.resumeFileName ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">MIME type</div>
              <div>{candidate.resumeMimeType ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Uploaded</div>
              <div>{candidate.resumeUploadedAt ? formatDateTime(candidate.resumeUploadedAt) : "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skill matches</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Skill extraction and match scoring will appear here after resume parsing is enabled.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interviews</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Interview sessions associated with this candidate will appear here.
        </CardContent>
      </Card>
    </div>
  );
}

