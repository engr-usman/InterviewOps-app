import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { RequirementType, SourceType } from "@prisma/client";
import { JobDescriptionAiPanel } from "@/features/ai/job-description-ai-panel";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function JobDescriptionDetailPage({
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
      parsedJdJson: true,
      aiMetadataJson: true,
      createdAt: true,
      updatedAt: true,
      skillRequirements: {
        select: {
          requirementType: true,
          priority: true,
          skill: { select: { id: true, name: true } },
        },
        orderBy: [{ requirementType: "asc" }, { priority: "desc" }],
        take: 200,
      },
    },
  });

  if (!jd) notFound();

  const parsed = jd.parsedJdJson as
    | null
    | {
        summary?: string;
        requiredSkills?: unknown;
        preferredSkills?: unknown;
        responsibilities?: unknown;
        experienceRequirements?: unknown;
      };

  const requiredSkills = jd.skillRequirements
    .filter((r) => r.requirementType === RequirementType.REQUIRED)
    .map((r) => r.skill.name);
  const preferredSkills = jd.skillRequirements
    .filter((r) => r.requirementType === RequirementType.PREFERRED)
    .map((r) => r.skill.name);

  const jdInterviews = await prisma.interview.findMany({
    where: { createdById: session.user.id, jobDescriptionId: jd.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
          skillMatches: { where: { sourceType: SourceType.RESUME }, select: { skillId: true } },
        },
      },
      scorecard: { select: { recommendation: true, overallScore: true } },
    },
  });

  const recCount = jdInterviews.filter((i) => i.scorecard?.recommendation).length;
  const hireCount = jdInterviews.filter(
    (i) => i.scorecard?.recommendation === "HIRE" || i.scorecard?.recommendation === "STRONG_HIRE",
  ).length;
  const successRate = recCount === 0 ? null : Math.round((hireCount / recCount) * 100);

  const requiredSkillIds = jd.skillRequirements
    .filter((r) => r.requirementType === RequirementType.REQUIRED)
    .map((r) => r.skill.id);
  const gapCounts = new Map<string, number>();
  for (const i of jdInterviews.slice(0, 30)) {
    const candidateSkillSet = new Set(i.candidate.skillMatches.map((m) => m.skillId));
    for (const skillId of requiredSkillIds) {
      if (!candidateSkillSet.has(skillId)) gapCounts.set(skillId, (gapCounts.get(skillId) ?? 0) + 1);
    }
  }
  const gapSkills = jd.skillRequirements
    .filter((r) => r.requirementType === RequirementType.REQUIRED)
    .map((r) => ({ skillId: r.skill.id, name: r.skill.name, missingCount: gapCounts.get(r.skill.id) ?? 0 }))
    .sort((a, b) => b.missingCount - a.missingCount)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={jd.title} description="Job description context for interview prep." />
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/job-descriptions">Back to Job Descriptions</Link>
          </Button>
          <Button asChild>
            <Link href={`/job-descriptions/${jd.id}/edit`}>Edit Job Description</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Department</div>
            <div>{jd.department ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Location</div>
            <div>{jd.location ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Seniority level</div>
            <div>{jd.seniorityLevel ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div>{formatDateTime(jd.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Updated</div>
            <div>{formatDateTime(jd.updatedAt)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm">{jd.descriptionText}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
          {jd.requirementsText ? jd.requirementsText : "—"}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parsed JD</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!parsed ? (
            <div className="text-muted-foreground">No parsed output yet. Save the job description to run analysis.</div>
          ) : (
            <>
              <div>
                <div className="text-muted-foreground">Summary</div>
                <div className="whitespace-pre-wrap">{parsed.summary ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Experience requirement</div>
                <div>{typeof parsed.experienceRequirements === "string" ? parsed.experienceRequirements : "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Responsibilities (sample)</div>
                <div className="text-muted-foreground">
                  {Array.isArray(parsed.responsibilities)
                    ? (parsed.responsibilities as string[]).slice(0, 8).join(" • ")
                    : "—"}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <JobDescriptionAiPanel jobDescriptionId={jd.id} aiMetadataJson={jd.aiMetadataJson} />

      <Card>
        <CardHeader>
          <CardTitle>Required skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {requiredSkills.length === 0 ? (
            <div className="text-muted-foreground">No required skills extracted yet.</div>
          ) : (
            <div className="text-muted-foreground">{requiredSkills.join(", ")}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferred skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {preferredSkills.length === 0 ? (
            <div className="text-muted-foreground">No preferred skills extracted yet.</div>
          ) : (
            <div className="text-muted-foreground">{preferredSkills.join(", ")}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Related interviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground">Interviews (last 50)</div>
              <div className="text-lg font-semibold">{jdInterviews.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Interview success rate</div>
              <div className="text-lg font-semibold">{successRate !== null ? `${successRate}%` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Common candidate gaps</div>
              <div className="text-muted-foreground">
                {gapSkills.filter((g) => g.missingCount > 0).length === 0 ? "—" : gapSkills.slice(0, 5).map((g) => g.name).join(", ")}
              </div>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <div className="text-sm font-medium">Top missing required skills (sample)</div>
            <div className="mt-2 space-y-2">
              {gapSkills.filter((g) => g.missingCount > 0).length === 0 ? (
                <div className="text-sm text-muted-foreground">No gap data yet.</div>
              ) : (
                gapSkills
                  .filter((g) => g.missingCount > 0)
                  .slice(0, 8)
                  .map((g) => (
                    <div key={g.skillId} className="flex items-center justify-between gap-3 text-sm">
                      <div className="text-muted-foreground">{g.name}</div>
                      <div className="text-muted-foreground">{g.missingCount}</div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
