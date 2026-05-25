import Link from "next/link";
import { redirect } from "next/navigation";
import type { Recommendation, ReportType } from "@prisma/client";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasFeature } from "@/server/services/feature-flags";
import { hasPermission } from "@/server/services/rbac";

export default async function ReportsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canViewReports = hasPermission(ctx.role, "reports:view");
  if (!canViewReports) {
    return (
      <div>
        <PageHeader title="Reports" description="Scorecards, feedback, and reports" />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">You do not have permission to view reports.</CardContent>
        </Card>
      </div>
    );
  }

  const exportsAllowed = await hasFeature(ctx.organization.id, "exports");

  const reports = await prisma.report.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      interview: {
        select: {
          id: true,
          candidate: { select: { fullName: true } },
          jobDescription: { select: { title: true } },
          scorecard: { select: { recommendation: true, overallScore: true } },
        },
      },
    },
  });

  function formatDate(value: Date) {
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(value);
  }

  function recBadgeVariant(rec: Recommendation | null): "secondary" | "muted" | "outline" {
    if (!rec) return "muted";
    if (rec === "STRONG_HIRE" || rec === "HIRE") return "secondary";
    if (rec === "BORDERLINE") return "outline";
    return "muted";
  }

  return (
    <div>
      <PageHeader title="Reports" description="Scorecards, feedback, and reports" />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Generated reports</span>
            {!exportsAllowed ? <Badge variant="outline">Exports gated by plan</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reports.length === 0 ? (
            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
              No reports yet. Open an interview and generate a report from the Scorecard section.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => {
                  const rec = r.interview.scorecard?.recommendation ?? null;
                  const score = r.interview.scorecard?.overallScore ?? null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.interview.candidate.fullName}</TableCell>
                      <TableCell className="text-muted-foreground">{r.interview.jobDescription.title}</TableCell>
                      <TableCell>
                        <Badge variant="muted">{String(r.type as ReportType)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={recBadgeVariant(rec)}>{rec ? String(rec) : "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{typeof score === "number" ? score.toFixed(2) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/reports/${r.id}`}>View</Link>
                          </Button>
                          {exportsAllowed ? (
                            <>
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/api/reports/${r.id}/json`}>JSON</Link>
                              </Button>
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/api/reports/${r.id}/csv`}>CSV</Link>
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              Export
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <div className="text-sm text-muted-foreground">
            PDF export is available via “Print / Save as PDF” inside each report.
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Generate reports from an interview’s Scorecard section.</div>
          <div>Exports are organization-scoped and require permission + plan access.</div>
        </CardContent>
      </Card>
    </div>
  );
}
