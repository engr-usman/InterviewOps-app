import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SourceType } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { computeCandidateVsJobDescriptionMatch } from "@/server/services/match-service";
import { CandidateAiPanel } from "@/features/ai/candidate-ai-panel";

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
      resumeFileUrl: true,
      resumeFileName: true,
      resumeMimeType: true,
      resumeUploadedAt: true,
      parsedResumeJson: true,
      aiMetadataJson: true,
      createdAt: true,
      updatedAt: true,
      skillMatches: {
        where: { sourceType: SourceType.RESUME },
        select: { confidence: true, skill: { select: { name: true } } },
        take: 50,
        orderBy: { confidence: "desc" },
      },
      interviews: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          jobDescription: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!candidate) notFound();

  const uniqueJobDescriptions = Array.from(
    new Map(candidate.interviews.map((i) => [i.jobDescription.id, i.jobDescription])).values(),
  ).slice(0, 3);

  const matchSummaries = await Promise.all(
    uniqueJobDescriptions.map(async (jd) => {
      const summary = await computeCandidateVsJobDescriptionMatch({
        candidateId: candidate.id,
        jobDescriptionId: jd.id,
        userId: session.user.id,
      });
      return { jobDescription: jd, summary };
    }),
  );

  const parsedResume = candidate.parsedResumeJson as
    | null
    | {
        summary?: string;
        yearsOfExperience?: number;
        skills?: unknown;
        cloudPlatforms?: unknown;
        tools?: unknown;
        certifications?: unknown;
        companies?: unknown;
        education?: unknown;
        projects?: unknown;
      };

  const extractedSkillNames = candidate.skillMatches.map((m) => m.skill.name);

  const candidateInterviewsWithScore = await prisma.interview.findMany({
    where: { createdById: session.user.id, candidateId: candidate.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      scorecard: { select: { overallScore: true, recommendation: true } },
      jobDescription: { select: { title: true } },
    },
  });

  const scoredInterviews = candidateInterviewsWithScore
    .map((i) => i.scorecard?.overallScore)
    .filter((s): s is number => typeof s === "number");
  const candidateAvgScore =
    scoredInterviews.length === 0
      ? null
      : Math.round((scoredInterviews.reduce((a, b) => a + b, 0) / scoredInterviews.length) * 100) / 100;
  const hireCount = candidateInterviewsWithScore.filter(
    (i) => i.scorecard?.recommendation === "HIRE" || i.scorecard?.recommendation === "STRONG_HIRE",
  ).length;
  const recCount = candidateInterviewsWithScore.filter((i) => i.scorecard?.recommendation).length;
  const candidateHireRate = recCount === 0 ? null : Math.round((hireCount / recCount) * 100);

  const topSkills = candidate.skillMatches.slice(0, 6);
  const bottomSkills = candidate.skillMatches.slice().reverse().slice(0, 6);

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
              <div>
                {candidate.resumeFileUrl && candidate.resumeFileName ? (
                  <a className="text-primary underline-offset-4 hover:underline" href={candidate.resumeFileUrl}>
                    {candidate.resumeFileName}
                  </a>
                ) : (
                  "—"
                )}
              </div>
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
          <CardTitle>Resume analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!parsedResume ? (
            <div className="text-muted-foreground">No parsed resume yet. Upload a resume to generate analysis.</div>
          ) : (
            <>
              <div>
                <div className="text-muted-foreground">Summary</div>
                <div className="whitespace-pre-wrap">{parsedResume.summary ?? "—"}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Years of experience</div>
                  <div>{typeof parsedResume.yearsOfExperience === "number" ? parsedResume.yearsOfExperience : "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Extracted skills</div>
                  <div className="text-muted-foreground">
                    {extractedSkillNames.length > 0
                      ? extractedSkillNames.slice(0, 20).join(", ")
                      : Array.isArray(parsedResume.skills)
                        ? (parsedResume.skills as string[]).slice(0, 20).join(", ")
                        : "—"}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CandidateAiPanel candidateId={candidate.id} aiMetadataJson={candidate.aiMetadataJson} />

      <Card>
        <CardHeader>
          <CardTitle>Interviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {candidate.interviews.length === 0 ? (
            <div className="text-muted-foreground">No interviews yet.</div>
          ) : (
            <div className="space-y-2">
              {candidate.interviews.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="font-medium">{i.jobDescription.title}</div>
                    <div className="text-muted-foreground">{formatDateTime(i.createdAt)}</div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/interviews/${i.id}`}>View interview</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Candidate analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground">Interviews (last 20)</div>
              <div className="text-lg font-semibold">{candidateInterviewsWithScore.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Average score</div>
              <div className="text-lg font-semibold">{candidateAvgScore ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Hire rate</div>
              <div className="text-lg font-semibold">{candidateHireRate !== null ? `${candidateHireRate}%` : "—"}</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border p-4">
              <div className="text-sm font-medium">Strongest skills (resume)</div>
              <div className="mt-2 space-y-2">
                {topSkills.length === 0 ? (
                  <div className="text-sm text-muted-foreground">—</div>
                ) : (
                  topSkills.map((s) => (
                    <div key={s.skill.name} className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{s.skill.name}</div>
                      <div className="text-muted-foreground">{typeof s.confidence === "number" ? s.confidence.toFixed(2) : "—"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-sm font-medium">Weakest skills (resume)</div>
              <div className="mt-2 space-y-2">
                {bottomSkills.length === 0 ? (
                  <div className="text-sm text-muted-foreground">—</div>
                ) : (
                  bottomSkills.map((s) => (
                    <div key={s.skill.name} className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{s.skill.name}</div>
                      <div className="text-muted-foreground">{typeof s.confidence === "number" ? s.confidence.toFixed(2) : "—"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <div className="text-sm font-medium">Recommendation trend (recent)</div>
            <div className="mt-2 space-y-2">
              {candidateInterviewsWithScore.length === 0 ? (
                <div className="text-sm text-muted-foreground">—</div>
              ) : (
                candidateInterviewsWithScore.slice(0, 8).map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">{i.jobDescription.title}</div>
                    <div className="text-muted-foreground">{i.scorecard?.recommendation ? String(i.scorecard.recommendation) : "—"}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skill match scoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {matchSummaries.length === 0 ? (
            <div className="text-muted-foreground">Link this candidate to a job description via an interview to see match scoring.</div>
          ) : (
            <div className="space-y-3">
              {matchSummaries.map(({ jobDescription, summary }) => (
                <div key={jobDescription.id} className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{jobDescription.title}</div>
                    <div className="text-muted-foreground">
                      {summary ? `${summary.matchPercentage}% match` : "No requirements extracted yet"}
                    </div>
                  </div>
                  {summary ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-muted-foreground">Matching skills</div>
                        <div className="text-muted-foreground">{summary.matchedSkills.slice(0, 12).join(", ") || "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Missing skills</div>
                        <div className="text-muted-foreground">{summary.missingSkills.slice(0, 12).join(", ") || "—"}</div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-muted-foreground">Suggested interview focus areas</div>
                        <div className="text-muted-foreground">{summary.focusAreas.join(", ") || "—"}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
