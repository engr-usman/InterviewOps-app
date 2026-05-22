import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateInterviewReportJson } from "@/server/reports/report-service";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

export default async function InterviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canViewReports = hasPermission(ctx.role, "reports:view");
  if (!canViewReports) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">You do not have permission to view reports.</CardContent>
      </Card>
    );
  }

  const { id } = await params;

  let report: unknown = null;
  try {
    report = await generateInterviewReportJson({ interviewId: id, organizationId: ctx.organization.id, userId: session.user.id });
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Interview report" description="JSON report output (export foundation)." />
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/reports">Back to Reports</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/interviews/${id}`}>Interview Detail</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(report, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
