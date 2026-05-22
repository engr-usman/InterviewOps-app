import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

type Db = {
  interview: { findMany: (args: unknown) => Promise<unknown> };
};

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

  const recentInterviews: Array<{
    id: string;
    createdAt: Date;
    candidate: { fullName: string };
    jobDescription: { title: string };
    scorecard: { recommendation: string | null; overallScore: number | null } | null;
  }> = (await (prisma as unknown as Db).interview.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      candidate: { select: { fullName: true } },
      jobDescription: { select: { title: true } },
      scorecard: { select: { recommendation: true, overallScore: true } },
    },
  })) as Array<{
    id: string;
    createdAt: Date;
    candidate: { fullName: string };
    jobDescription: { title: string };
    scorecard: { recommendation: string | null; overallScore: number | null } | null;
  }>;

  return (
    <div>
      <PageHeader title="Reports" description="Scorecards, feedback, and reports" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Report engine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>JSON report output is supported now (foundation).</div>
            <div>CSV/PDF export are placeholders to be implemented later.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export placeholders</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled>
              Export PDF (placeholder)
            </Button>
            <Button type="button" variant="outline" disabled>
              Export CSV (placeholder)
            </Button>
            <Button type="button" variant="outline" disabled>
              Export JSON (placeholder)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent interview reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {recentInterviews.length === 0 ? (
            <div className="text-muted-foreground">No interviews yet.</div>
          ) : (
            <div className="space-y-2">
              {recentInterviews.map((i) => (
                <div key={i.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">
                      {i.candidate.fullName} — {i.jobDescription.title}
                    </div>
                    <div className="text-muted-foreground">
                      {i.scorecard?.recommendation ? String(i.scorecard.recommendation) : "No recommendation"} •{" "}
                      {typeof i.scorecard?.overallScore === "number" ? i.scorecard.overallScore.toFixed(2) : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/reports/interviews/${i.id}`}>View JSON</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/interviews/${i.id}`}>Interview</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
