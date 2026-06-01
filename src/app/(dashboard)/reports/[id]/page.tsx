import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Recommendation, ReportType } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import type { InterviewReport } from "@/lib/reports/types";
import { PrintButton } from "@/features/reports/print-button";
import { QuestionScoreBadge } from "@/features/interviews/question-score-badge";
import { getScoreBand } from "@/features/interviews/score-band";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasFeature } from "@/server/services/feature-flags";
import { hasPermission } from "@/server/services/rbac";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function recBadgeVariant(rec: Recommendation | null): "secondary" | "muted" | "outline" {
  if (!rec) return "muted";
  if (rec === "STRONG_HIRE" || rec === "HIRE") return "secondary";
  if (rec === "BORDERLINE") return "outline";
  return "muted";
}

function scoreToneBadge(score: number | null): { label: string; className: string } {
  if (typeof score !== "number") {
    return {
      label: "Not available",
      className:
        "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
    };
  }
  if (score >= 8) {
    return {
      label: "Strong",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
    };
  }
  if (score >= 6) {
    return {
      label: "Good",
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    };
  }
  return {
    label: "Needs Improvement",
    className: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  };
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toListFromMultiline(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  if (!hasPermission(ctx.role, "reports:view")) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">You do not have permission to view reports.</CardContent>
      </Card>
    );
  }

  const exportsAllowed = await hasFeature(ctx.organization.id, "exports");
  const { id } = await params;

  const report = await prisma.report.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: {
      id: true,
      type: true,
      title: true,
      reportJson: true,
      createdAt: true,
      updatedAt: true,
      interview: {
        select: {
          id: true,
          status: true,
          candidate: { select: { fullName: true } },
          jobDescription: { select: { title: true } },
          scorecard: { select: { recommendation: true, overallScore: true, summaryText: true, scorecardJson: true, metadataJson: true } },
        },
      },
    },
  });

  if (!report) notFound();

  const payload = report.reportJson as unknown as InterviewReport;
  const details = payload.details ?? {
    candidateSummary: null,
    jobDescriptionSummary: null,
    strengths: [],
    weaknesses: [],
    interviewerStrongAreas: null,
    interviewerConcerns: null,
    interviewerFinalNotes: null,
  };

  const scorecardJson = (report.interview.scorecard?.scorecardJson ?? null) as
    | null
    | { strongAreas?: unknown; hiringConcerns?: unknown; finalRecommendation?: unknown };
  const strengths = details.strengths.length > 0 ? details.strengths : toListFromMultiline(scorecardJson?.strongAreas);
  const weaknesses = details.weaknesses.length > 0 ? details.weaknesses : toListFromMultiline(scorecardJson?.hiringConcerns);

  const recommendation = (report.interview.scorecard?.recommendation ?? null) as Recommendation | null;
  const overallScore = report.interview.scorecard?.overallScore ?? null;
  const breakdown =
    payload.details?.evaluationBreakdown ??
    (report.interview.scorecard
      ? {
          technicalAverage: typeof (report.interview.scorecard.scorecardJson as { technicalAverage?: unknown } | null)?.technicalAverage === "number"
            ? ((report.interview.scorecard.scorecardJson as { technicalAverage?: unknown }).technicalAverage as number)
            : null,
          communication: typeof (report.interview.scorecard.scorecardJson as { communicationScore?: unknown } | null)?.communicationScore === "number"
            ? ((report.interview.scorecard.scorecardJson as { communicationScore?: unknown }).communicationScore as number)
            : null,
          problemSolving: typeof (report.interview.scorecard.scorecardJson as { problemSolvingScore?: unknown } | null)?.problemSolvingScore === "number"
            ? ((report.interview.scorecard.scorecardJson as { problemSolvingScore?: unknown }).problemSolvingScore as number)
            : null,
          interviewerTechnicalAssessment:
            typeof (report.interview.scorecard.scorecardJson as { interviewerTechnicalAssessment?: unknown } | null)
              ?.interviewerTechnicalAssessment === "number"
              ? ((report.interview.scorecard.scorecardJson as { interviewerTechnicalAssessment?: unknown })
                  .interviewerTechnicalAssessment as number)
              : typeof (report.interview.scorecard.scorecardJson as { cloudDevOpsScore?: unknown } | null)?.cloudDevOpsScore === "number"
                ? ((report.interview.scorecard.scorecardJson as { cloudDevOpsScore?: unknown }).cloudDevOpsScore as number)
                : null,
          overallScore,
          recommendation: recommendation ? String(recommendation) : null,
          autoRecommendation:
            typeof (report.interview.scorecard.metadataJson as { autoRecommendation?: unknown } | null)?.autoRecommendation === "string"
              ? ((report.interview.scorecard.metadataJson as { autoRecommendation?: unknown }).autoRecommendation as string)
              : null,
          manualOverride:
            (report.interview.scorecard.metadataJson as { manualOverride?: unknown } | null)?.manualOverride === true,
        }
      : null);
  const overallTone = scoreToneBadge(typeof breakdown?.overallScore === "number" ? breakdown.overallScore : null);
  const techTone = scoreToneBadge(typeof breakdown?.technicalAverage === "number" ? breakdown.technicalAverage : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <PageHeader title="Report" description="Shareable interview report" />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/reports">Back to Reports</Link>
          </Button>
          <PrintButton />
          {exportsAllowed ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/api/reports/${report.id}/json`}>Export JSON</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/api/reports/${report.id}/csv`}>Export CSV</Link>
              </Button>
            </>
          ) : (
            <Button variant="outline" disabled>
              Export (upgrade)
            </Button>
          )}
        </div>
      </div>

      {payload.warnings && payload.warnings.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/60 print:hidden dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="p-4 text-sm text-amber-900 dark:text-amber-200">
            <div className="font-medium">Report generated with warnings</div>
            <div className="mt-2 space-y-1">
              {payload.warnings.map((w) => (
                <div key={w}>• {w}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="print:border-none print:shadow-none">
        <CardHeader className="space-y-2">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 truncate">{report.title}</span>
            <Badge variant="muted">{String(report.type as ReportType)}</Badge>
            <Badge variant={recBadgeVariant(recommendation)}>{recommendation ? String(recommendation) : "—"}</Badge>
            <Badge variant="outline">{typeof overallScore === "number" ? overallScore.toFixed(2) : "—"}</Badge>
          </CardTitle>
          <div className="text-sm text-muted-foreground">{report.interview.candidate.fullName} • {report.interview.jobDescription.title}</div>
          <div className="text-sm text-muted-foreground">Updated {formatDateTime(report.updatedAt)}</div>
        </CardHeader>
        <CardContent className="space-y-6">
          {breakdown ? (
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Candidate Evaluation Breakdown</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Technical Average</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {typeof breakdown.technicalAverage === "number" ? `${breakdown.technicalAverage.toFixed(2)} / 10` : "—"}
                    </span>
                    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none", techTone.className)}>
                      {techTone.label}
                    </span>
                  </div>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Communication</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {typeof breakdown.communication === "number" ? `${breakdown.communication.toFixed(2)} / 10` : "—"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
                        scoreToneBadge(typeof breakdown.communication === "number" ? breakdown.communication : null).className,
                      )}
                    >
                      {scoreToneBadge(typeof breakdown.communication === "number" ? breakdown.communication : null).label}
                    </span>
                  </div>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Problem Solving</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {typeof breakdown.problemSolving === "number" ? `${breakdown.problemSolving.toFixed(2)} / 10` : "—"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
                        scoreToneBadge(typeof breakdown.problemSolving === "number" ? breakdown.problemSolving : null).className,
                      )}
                    >
                      {scoreToneBadge(typeof breakdown.problemSolving === "number" ? breakdown.problemSolving : null).label}
                    </span>
                  </div>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Interviewer Technical Assessment</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {typeof breakdown.interviewerTechnicalAssessment === "number"
                        ? `${breakdown.interviewerTechnicalAssessment.toFixed(2)} / 10`
                        : "—"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
                        scoreToneBadge(
                          typeof breakdown.interviewerTechnicalAssessment === "number"
                            ? breakdown.interviewerTechnicalAssessment
                            : null,
                        ).className,
                      )}
                    >
                      {scoreToneBadge(
                        typeof breakdown.interviewerTechnicalAssessment === "number"
                          ? breakdown.interviewerTechnicalAssessment
                          : null,
                      ).label}
                    </span>
                  </div>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Overall Score</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {typeof breakdown.overallScore === "number" ? `${breakdown.overallScore.toFixed(2)} / 10` : "—"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
                        overallTone.className,
                      )}
                    >
                      {overallTone.label}
                    </span>
                  </div>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Recommendation</div>
                  <div className="mt-1 text-lg font-semibold">{breakdown.recommendation ?? "—"}</div>
                  {breakdown.manualOverride ? (
                    <div className="mt-1 text-xs text-muted-foreground">Manual Recommendation Override</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Candidate summary</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{details.candidateSummary ?? "—"}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Job description summary</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{details.jobDescriptionSummary ?? "—"}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Interview</div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div>Status: {String(report.interview.status)}</div>
                <div>Interview ID: {report.interview.id}</div>
                <div>Report ID: {report.id}</div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Score summary</div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div>Overall: {typeof overallScore === "number" ? overallScore.toFixed(2) : "—"}</div>
                <div>Recommendation: {recommendation ? String(recommendation) : "—"}</div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Generated</div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div>{formatDateTime(report.createdAt)}</div>
                <div className="text-xs">v{payload.version}</div>
              </div>
            </div>
          </div>

          <Separator className="print:hidden" />

          <div className="space-y-2">
            <div className="text-sm font-medium">Recommendation summary</div>
            <div className="rounded-lg border p-4 text-sm text-muted-foreground whitespace-pre-wrap">
              {report.interview.scorecard?.summaryText ?? "—"}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Strengths</div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {strengths.length === 0 ? (
                  <div>—</div>
                ) : (
                  strengths.slice(0, 12).map((s) => <div key={s}>• {s}</div>)
                )}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Weaknesses</div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {weaknesses.length === 0 ? (
                  <div>—</div>
                ) : (
                  weaknesses.slice(0, 12).map((s) => <div key={s}>• {s}</div>)
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Question-by-question evaluation</div>
            {payload.questions.length === 0 ? (
              <div className="rounded-lg border p-6 text-sm text-muted-foreground">No questions were recorded.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead className="w-[90px] text-right">Score</TableHead>
                    <TableHead className="w-[240px]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.questions.map((q) => {
                    const meta = q.evaluation?.metadataJson as
                      | { strengthsNotes?: unknown; weaknessesNotes?: unknown; status?: unknown }
                      | null;
                    const sNotes = readText(meta?.strengthsNotes);
                    const wNotes = readText(meta?.weaknessesNotes);
                    const overallNotes = readText(q.evaluation?.notesText);
                    const score = typeof q.evaluation?.score === "number" ? q.evaluation.score : null;
                    const band = getScoreBand(score, 10);
                    const isWeak = band.label === "Weak" || band.label === "Invalid score";
                    const statusRaw = meta?.status;
                    const statusLabel =
                      statusRaw === "IN_REVIEW"
                        ? "In review"
                        : statusRaw === "EVALUATED" || typeof score === "number"
                          ? "Evaluated"
                          : "Pending";
                    const statusToneClass =
                      statusLabel === "Evaluated"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : statusLabel === "In review"
                          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                          : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200";
                    return (
                      <TableRow
                        key={q.id}
                        className={
                          isWeak
                            ? "bg-red-50/40 dark:bg-red-950/20"
                            : undefined
                        }
                      >
                        <TableCell className="text-muted-foreground">{q.order}</TableCell>
                        <TableCell>
                          <div className="font-medium">{q.topic ?? "—"}</div>
                          <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{q.questionText}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
                                statusToneClass,
                              )}
                            >
                              {statusLabel}
                            </span>
                            <QuestionScoreBadge score={score} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {sNotes ? <div>Strengths: {sNotes}</div> : null}
                            {wNotes ? <div>Weaknesses: {wNotes}</div> : null}
                            {overallNotes ? <div>Notes: {overallNotes}</div> : null}
                            {!sNotes && !wNotes && !overallNotes ? <div>—</div> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Final notes</div>
            <div className="rounded-lg border p-4 text-sm text-muted-foreground whitespace-pre-wrap">
              {details.interviewerFinalNotes ?? readText(scorecardJson?.finalRecommendation) ?? "—"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
