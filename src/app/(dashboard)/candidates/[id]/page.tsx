import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { computeCandidateVsJobDescriptionMatch } from "@/server/services/match-service";
import { CandidateAiPanel } from "@/features/ai/candidate-ai-panel";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";
import { getCandidateResumeSkillMatches } from "@/server/services/resume-service";

export const dynamic = "force-dynamic";

type Db = {
  candidate: { findFirst: (args: unknown) => Promise<unknown> };
  interview: { findMany: (args: unknown) => Promise<unknown> };
};

type CandidateDetailRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  seniorityLevel: string | null;
  linkedInUrl: string | null;
  githubUrl: string | null;
  resumeFileUrl: string | null;
  resumeFileName: string | null;
  resumeMimeType: string | null;
  resumeUploadedAt: Date | null;
  parsedResumeJson: unknown;
  aiMetadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  interviews: Array<{ id: string; createdAt: Date; jobDescription: { id: string; title: string } }>;
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

function renderBadges(values: string[]) {
  if (values.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="px-2 py-0.5">
          {v}
        </Badge>
      ))}
    </div>
  );
}

function pickStrongestSkillsFromCategories(input: {
  categories: {
    cloudPlatforms: string[];
    awsServices: string[];
    azureServices?: string[];
    gcpServices?: string[];
    containersOrchestration: string[];
    infrastructureAsCode: string[];
    cicd: string[];
    monitoringLogging: string[];
    securityDevsecops: string[];
    databases: string[];
    programmingScripting: string[];
    leadershipArchitecture: string[];
    sreReliability: string[];
  };
  max: number;
}): string[] {
  const categoryOrder: Array<keyof typeof input.categories> = [
    "leadershipArchitecture",
    "sreReliability",
    "securityDevsecops",
    "monitoringLogging",
    "infrastructureAsCode",
    "containersOrchestration",
    "cicd",
    "cloudPlatforms",
    "gcpServices",
    "azureServices",
    "awsServices",
    "programmingScripting",
    "databases",
  ];

  const normalized = new Map<string, string>();
  const byCategory = categoryOrder.map((key) => ({
    key,
    items: uniqueCaseInsensitive(input.categories[key] ?? []).sort((a, b) => skillPriority(b) - skillPriority(a)),
  }));

  const out: string[] = [];
  const maxPerCategoryFirstPass = 1;
  const maxPerCategorySecondPass = 2;

  for (const pass of [maxPerCategoryFirstPass, maxPerCategorySecondPass]) {
    for (const c of byCategory) {
      for (const item of c.items.slice(0, pass)) {
        const k = item.toLowerCase();
        if (normalized.has(k)) continue;
        normalized.set(k, item);
        out.push(item);
        if (out.length >= input.max) return out;
      }
    }
  }

  return out.slice(0, input.max);
}

function pickStrongestSkillNames(input: {
  categories: CandidateDetailPageCategories | null;
  parsedSkills: string[];
  skillMatches: Array<{ confidence: number | null; skill: { name: string } }>;
  max: number;
}): { names: string[]; source: "parsedResumeJson.skillCategories" | "parsedResumeJson.skills" | "CandidateSkillMatch"; loadedCount: number } {
  if (input.categories) {
    const names = pickStrongestSkillsFromCategories({ categories: input.categories, max: input.max });
    if (names.length > 0) return { names, source: "parsedResumeJson.skillCategories", loadedCount: names.length };
  }

  if (input.parsedSkills.length > 0) {
    const names = uniqueCaseInsensitive(input.parsedSkills)
      .sort((a, b) => skillPriority(b) - skillPriority(a) || a.localeCompare(b))
      .slice(0, input.max);
    if (names.length > 0) return { names, source: "parsedResumeJson.skills", loadedCount: names.length };
  }

  const names = input.skillMatches
    .map((m) => m.skill.name)
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .filter((s, idx, arr) => arr.findIndex((t) => t.toLowerCase() === s.toLowerCase()) === idx)
    .slice(0, 120)
    .sort((a, b) => skillPriority(b) - skillPriority(a) || a.localeCompare(b))
    .slice(0, input.max);
  return { names, source: "CandidateSkillMatch", loadedCount: names.length };
}

function skillPriority(name: string): number {
  const k = name.trim().toLowerCase();
  if (k === "aws") return 100;
  if (k === "kubernetes") return 98;
  if (k === "terraform") return 96;
  if (k === "ci/cd") return 94;
  if (k === "cloud architecture") return 93;
  if (k === "leadership") return 92;
  if (k === "aws well-architected") return 91;
  if (k === "github actions") return 92;
  if (k === "jenkins") return 90;
  if (k === "docker") return 88;
  if (k === "prometheus") return 86;
  if (k === "grafana") return 84;
  if (k === "cloudwatch") return 82;
  if (k === "aws lambda") return 81;
  if (k === "lambda") return 81;
  if (k === "dynamodb") return 80;
  if (k === "eventbridge") return 79;
  if (k === "api gateway") return 78;
  if (k === "ansible") return 80;
  if (k === "helm") return 78;
  if (k === "linux") return 76;
  if (k === "sre") return 74;
  if (k === "incident response") return 72;
  if (k === "cost optimization") return 71;
  if (k === "disaster recovery") return 70;
  if (k === "high availability") return 69;
  if (k === "security hardening") return 70;
  if (k === "observability") return 68;
  return 10;
}

type CandidateDetailPageCategories = {
  cloudPlatforms: string[];
  awsServices: string[];
  azureServices?: string[];
  gcpServices?: string[];
  containersOrchestration: string[];
  infrastructureAsCode: string[];
  cicd: string[];
  monitoringLogging: string[];
  securityDevsecops: string[];
  databases: string[];
  programmingScripting: string[];
  leadershipArchitecture: string[];
  sreReliability: string[];
};

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManage = hasPermission(ctx.role, "candidate:manage");

  const { id } = await params;

  const db = prisma as unknown as Db;
  const candidate = (await db.candidate.findFirst({
    where: {
      id,
      organizationId: ctx.organization.id,
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
  })) as CandidateDetailRow | null;

  if (!candidate) notFound();

  const skillMatches = await getCandidateResumeSkillMatches({
    candidateId: candidate.id,
    organizationId: ctx.organization.id,
    take: 50,
  });
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[candidate-detail] resume skills candidateId=${candidate.id} orgId=${ctx.organization.id} count=${skillMatches.length}`,
    );
  }

  const uniqueJobDescriptions = Array.from(
    new Map<string, { id: string; title: string }>(
      candidate.interviews.map((i: { jobDescription: { id: string; title: string } }) => [
        i.jobDescription.id,
        i.jobDescription,
      ]),
    ).values(),
  ).slice(0, 3);

  const matchSummaries = await Promise.all(
    uniqueJobDescriptions.map(async (jd: { id: string; title: string }) => {
      const summary = await computeCandidateVsJobDescriptionMatch({
        candidateId: candidate.id,
        jobDescriptionId: jd.id,
        organizationId: ctx.organization.id,
      });
      return { jobDescription: jd, summary };
    }),
  );

  const parsedResume = candidate.parsedResumeJson as
    | null
    | {
        parsedAt?: unknown;
        candidateId?: unknown;
        resumeFileName?: unknown;
        resumeFileSize?: unknown;
        resumeMimeType?: unknown;
        summary?: string;
        yearsOfExperience?: number;
        yearsOfExperienceText?: unknown;
        skills?: unknown;
        cloudPlatforms?: unknown;
        tools?: unknown;
        certifications?: unknown;
        skillCategories?: unknown;
        leadershipIndicators?: unknown;
        companies?: unknown;
        education?: unknown;
        projects?: unknown;
        extractedTextPreview?: unknown;
        extractionStatus?: unknown;
        extractionError?: unknown;
        extractionMethod?: unknown;
        extraction?: {
          ok?: unknown;
          status?: unknown;
          message?: unknown;
          fileType?: unknown;
          mimeType?: unknown;
        };
      };

  const extractionStatus =
    parsedResume && typeof parsedResume.extractionStatus === "string"
      ? (parsedResume.extractionStatus as string)
      : parsedResume && typeof parsedResume.extraction?.ok === "boolean"
        ? ((parsedResume.extraction.ok as boolean) ? "success" : "failed")
        : null;
  const extractionOk = extractionStatus === "success" ? true : extractionStatus === "failed" ? false : null;
  const extractionMessage =
    parsedResume && typeof parsedResume.extraction?.message === "string" ? (parsedResume.extraction.message as string) : null;
  const extractionMethod =
    parsedResume && typeof parsedResume.extractionMethod === "string" ? (parsedResume.extractionMethod as string) : null;
  const extractionError =
    parsedResume && typeof parsedResume.extractionError === "string" ? (parsedResume.extractionError as string) : null;
  const isDev = process.env.NODE_ENV !== "production";

  const routeCandidateId = id;
  const parsedAt = parsedResume && typeof parsedResume.parsedAt === "string" ? (parsedResume.parsedAt as string) : null;
  const parsedCandidateId =
    parsedResume && typeof parsedResume.candidateId === "string" ? (parsedResume.candidateId as string) : null;
  const parsedResumeFileName =
    parsedResume && typeof parsedResume.resumeFileName === "string" ? (parsedResume.resumeFileName as string) : null;
  const parsedResumeFileSize =
    parsedResume && typeof parsedResume.resumeFileSize === "number" ? (parsedResume.resumeFileSize as number) : null;
  const parsedResumeMimeType =
    parsedResume && typeof parsedResume.resumeMimeType === "string" ? (parsedResume.resumeMimeType as string) : null;

  const yearsText =
    parsedResume && typeof parsedResume.yearsOfExperienceText === "string"
      ? (parsedResume.yearsOfExperienceText as string)
      : typeof parsedResume?.yearsOfExperience === "number"
        ? String(parsedResume.yearsOfExperience)
        : null;

  const summaryTextRaw = parsedResume && typeof parsedResume.summary === "string" ? (parsedResume.summary as string) : null;
  const summaryText = summaryTextRaw
    ? summaryTextRaw.replace(/^resume summary\s*\(mock\)\s*:\s*/i, "").replace(/\(mock\)/gi, "").trim()
    : null;

  const certs = asStringArray(parsedResume?.certifications);
  const trainings = asStringArray((parsedResume as { trainings?: unknown } | null)?.trainings);
  const leadership = asStringArray(parsedResume?.leadershipIndicators);
  const categoriesRoot =
    parsedResume && typeof parsedResume.skillCategories === "object" && parsedResume.skillCategories !== null
      ? (parsedResume.skillCategories as Record<string, unknown>)
      : null;
  const categories: CandidateDetailPageCategories | null = categoriesRoot
    ? {
        cloudPlatforms: asStringArray(categoriesRoot.cloudPlatforms),
        awsServices: asStringArray(categoriesRoot.awsServices),
        azureServices: asStringArray(categoriesRoot.azureServices),
        gcpServices: asStringArray(categoriesRoot.gcpServices),
        containersOrchestration: asStringArray(categoriesRoot.containersOrchestration),
        infrastructureAsCode: asStringArray(categoriesRoot.infrastructureAsCode),
        cicd: asStringArray(categoriesRoot.cicd),
        monitoringLogging: asStringArray(categoriesRoot.monitoringLogging),
        securityDevsecops: asStringArray(categoriesRoot.securityDevsecops),
        databases: asStringArray(categoriesRoot.databases),
        programmingScripting: asStringArray(categoriesRoot.programmingScripting),
        leadershipArchitecture: asStringArray(categoriesRoot.leadershipArchitecture),
        sreReliability: asStringArray(categoriesRoot.sreReliability),
      }
    : null;

  const candidateInterviewsWithScore: Array<{
    id: string;
    createdAt: Date;
    jobDescription: { title: string };
    scorecard: { overallScore: number | null; recommendation: string | null } | null;
  }> = (await db.interview.findMany({
    where: { organizationId: ctx.organization.id, candidateId: candidate.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      scorecard: { select: { overallScore: true, recommendation: true } },
      jobDescription: { select: { title: true } },
    },
  })) as Array<{
    id: string;
    createdAt: Date;
    jobDescription: { title: string };
    scorecard: { overallScore: number | null; recommendation: string | null } | null;
  }>;

  const scoredInterviews = candidateInterviewsWithScore
    .map((i: { scorecard: { overallScore: number | null } | null }) => i.scorecard?.overallScore)
    .filter((s: unknown): s is number => typeof s === "number");
  const candidateAvgScore =
    scoredInterviews.length === 0
      ? null
      : Math.round((scoredInterviews.reduce((a: number, b: number) => a + b, 0) / scoredInterviews.length) * 100) / 100;
  const hireCount = candidateInterviewsWithScore.filter(
    (i: { scorecard: { recommendation: string | null } | null }) =>
      i.scorecard?.recommendation === "HIRE" || i.scorecard?.recommendation === "STRONG_HIRE",
  ).length;
  const recCount = candidateInterviewsWithScore.filter((i: { scorecard: { recommendation: string | null } | null }) => i.scorecard?.recommendation).length;
  const candidateHireRate = recCount === 0 ? null : Math.round((hireCount / recCount) * 100);

  const parsedSkills = asStringArray((parsedResume as { skills?: unknown } | null)?.skills);
  const strongest = pickStrongestSkillNames({
    categories,
    parsedSkills,
    skillMatches,
    max: 6,
  });
  const confidenceBySkill = new Map<string, number | null>(
    skillMatches.map((m) => [m.skill.name.toLowerCase(), typeof m.confidence === "number" ? m.confidence : null]),
  );
  const strongestRows = strongest.names.map((name) => ({
    name,
    confidence: confidenceBySkill.get(name.toLowerCase()) ?? null,
  }));
  const jdMissingSkills = uniqueCaseInsensitive(matchSummaries.flatMap((m) => m.summary?.missingSkills ?? [])).slice(0, 12);
  const hasJdComparison = matchSummaries.some((m) => Boolean(m.summary));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={candidate.fullName} description="Candidate profile and interview context." />
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/candidates">Back to Candidates</Link>
          </Button>
          {canManage ? (
            <Button asChild>
              <Link href={`/candidates/${candidate.id}/edit`}>Edit Candidate</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {isDev ? (
        <Card>
          <CardHeader>
            <CardTitle>Debug: Candidate scoping (dev)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Route candidateId</div>
              <div>{routeCandidateId}</div>
            </div>
            <div>
              <div className="text-muted-foreground">DB candidateId</div>
              <div>{candidate.id}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Candidate name</div>
              <div>{candidate.fullName}</div>
            </div>
            <div>
              <div className="text-muted-foreground">OrganizationId</div>
              <div>{ctx.organization.id}</div>
            </div>
            <div>
              <div className="text-muted-foreground">parsedResumeJson.candidateId</div>
              <div>{parsedCandidateId ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">parsedResumeJson.parsedAt</div>
              <div>{parsedAt ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">parsedResumeJson.resumeFileName</div>
              <div>{parsedResumeFileName ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">parsedResumeJson.resumeFileSize</div>
              <div>{typeof parsedResumeFileSize === "number" ? `${parsedResumeFileSize} bytes` : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">extractionMethod</div>
              <div>{extractionMethod ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">extractionStatus</div>
              <div>{extractionStatus ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">resumeMimeType</div>
              <div>{parsedResumeMimeType ?? candidate.resumeMimeType ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">CandidateSkillMatch (RESUME) rows loaded</div>
              <div>{skillMatches.length}</div>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
              {extractionOk === false ? (
                <div className="rounded-md border p-3 text-muted-foreground">
                  <div>{extractionMessage ?? "Resume uploaded successfully, but text extraction failed."}</div>
                  {isDev && (extractionMethod || extractionError) ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {extractionMethod ? `Method: ${extractionMethod}` : null}
                      {extractionMethod && extractionError ? " • " : null}
                      {extractionError ? `Parser error: ${extractionError}` : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div>
                <div className="text-muted-foreground">Summary</div>
                <div className="whitespace-pre-wrap">{summaryText ?? "—"}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Years of experience</div>
                  <div>{yearsText ? `${yearsText} years` : "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Resume skills</div>
                  <div className="text-muted-foreground">Grouped categories appear below.</div>
                </div>
              </div>
              {categories ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {categories.cloudPlatforms.length > 0 ? (
                    <div>
                      <div className="text-muted-foreground">Cloud Platforms</div>
                      {renderBadges(categories.cloudPlatforms)}
                    </div>
                  ) : null}
                  {categories.awsServices.length > 0 ? (
                    <div>
                      <div className="text-muted-foreground">AWS Services</div>
                      {renderBadges(categories.awsServices)}
                    </div>
                  ) : null}
                  {categories.containersOrchestration.length > 0 ? (
                    <div>
                      <div className="text-muted-foreground">Containers & Orchestration</div>
                      {renderBadges(categories.containersOrchestration)}
                    </div>
                  ) : null}
                  {categories.infrastructureAsCode.length > 0 ? (
                    <div>
                      <div className="text-muted-foreground">Infrastructure as Code</div>
                      {renderBadges(categories.infrastructureAsCode)}
                    </div>
                  ) : null}
                  {categories.cicd.length > 0 ? (
                    <div>
                      <div className="text-muted-foreground">CI/CD</div>
                      {renderBadges(categories.cicd)}
                    </div>
                  ) : null}
                  {categories.monitoringLogging.length > 0 ? (
                    <div>
                      <div className="text-muted-foreground">Monitoring & Logging</div>
                      {renderBadges(categories.monitoringLogging)}
                    </div>
                  ) : null}
                  {categories.securityDevsecops.length > 0 ? (
                    <div>
                      <div className="text-muted-foreground">Security & DevSecOps</div>
                      {renderBadges(categories.securityDevsecops)}
                    </div>
                  ) : null}
                  {categories.sreReliability.length > 0 ? (
                    <div>
                      <div className="text-muted-foreground">SRE / Reliability</div>
                      {renderBadges(categories.sreReliability)}
                    </div>
                  ) : null}
                  {categories.databases.length > 0 ? (
                    <div>
                      <div className="text-muted-foreground">Databases</div>
                      {renderBadges(categories.databases)}
                    </div>
                  ) : null}
                  {categories.programmingScripting.length > 0 ? (
                    <div>
                      <div className="text-muted-foreground">Programming/Scripting</div>
                      {renderBadges(categories.programmingScripting)}
                    </div>
                  ) : null}
                  {categories.leadershipArchitecture.length > 0 ? (
                    <div className="sm:col-span-2">
                      <div className="text-muted-foreground">Leadership & Architecture</div>
                      {renderBadges(categories.leadershipArchitecture)}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div>
                <div className="text-muted-foreground">Leadership & architecture indicators</div>
                {leadership.length === 0 ? <div className="text-muted-foreground">—</div> : renderBadges(leadership)}
              </div>
              {isDev && extractionOk === true && typeof parsedResume.extractedTextPreview === "string" ? (
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground">Show extracted text preview (dev)</summary>
                  <div className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                    {(parsedResume.extractedTextPreview as string).slice(0, 1200)}
                  </div>
                </details>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certifications & trainings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!parsedResume ? (
            <div className="text-muted-foreground">Upload a resume to extract certifications and trainings.</div>
          ) : (
            <>
              <div>
                <div className="text-muted-foreground">Certifications</div>
                {certs.length === 0 ? <div className="text-muted-foreground">No certifications detected yet.</div> : renderBadges(certs)}
              </div>
              <div>
                <div className="text-muted-foreground">Trainings / community</div>
                {trainings.length === 0 ? <div className="text-muted-foreground">No trainings detected yet.</div> : renderBadges(trainings)}
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
              {candidate.interviews.map((i: { id: string; createdAt: Date; jobDescription: { title: string } }) => (
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
                {strongestRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No skills detected yet</div>
                ) : (
                  strongestRows.map((s) => (
                    <div key={s.name} className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">{s.name}</div>
                      <div className="text-muted-foreground">{typeof s.confidence === "number" ? s.confidence.toFixed(2) : "—"}</div>
                    </div>
                  ))
                )}
              </div>
              {isDev ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  candidateId={candidate.id} • source={strongest.source} • count={strongest.loadedCount}
                </div>
              ) : null}
            </div>
            <div className="rounded-md border p-4">
              <div className="text-sm font-medium">Skill gaps (JD comparison)</div>
              <div className="mt-2 space-y-2">
                {!hasJdComparison ? (
                  <div className="text-sm text-muted-foreground">
                    Skill gaps will appear after linking this candidate to a Job Description via an interview.
                  </div>
                ) : jdMissingSkills.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No missing skills detected from linked Job Descriptions.</div>
                ) : (
                  jdMissingSkills.slice(0, 8).map((name) => (
                    <div key={name} className="text-muted-foreground">
                      {name}
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
