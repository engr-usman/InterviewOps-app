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
import type { InterviewReport } from "@/lib/reports/types";
import { PrintButton } from "@/features/reports/print-button";
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
          scorecard: { select: { recommendation: true, overallScore: true, summaryText: true, scorecardJson: true } },
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
          <div className="text-sm text-muted-foreground">
            {report.interview.candidate.fullName} • {report.interview.jobDescription.title} • Updated{" "}
            {formatDateTime(report.updatedAt)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
                    const meta = q.evaluation?.metadataJson as { strengthsNotes?: unknown; weaknessesNotes?: unknown } | null;
                    const sNotes = readText(meta?.strengthsNotes);
                    const wNotes = readText(meta?.weaknessesNotes);
                    const overallNotes = readText(q.evaluation?.notesText);
                    return (
                      <TableRow key={q.id}>
                        <TableCell className="text-muted-foreground">{q.order}</TableCell>
                        <TableCell>
                          <div className="font-medium">{q.topic ?? "—"}</div>
                          <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{q.questionText}</div>
                        </TableCell>
                        <TableCell className="text-right">{typeof q.evaluation?.score === "number" ? q.evaluation.score : "—"}</TableCell>
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
