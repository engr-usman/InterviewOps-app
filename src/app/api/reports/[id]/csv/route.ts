import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgFeature, requireOrgPermission } from "@/server/services/access";
import type { InterviewReport } from "@/lib/reports/types";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const needsQuotes = s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r");
  const escaped = s.replace(/"/g, "\"\"");
  return needsQuotes ? `"${escaped}"` : escaped;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  await requireOrgPermission(session.user.id, "reports:view");
  const ctx = await requireOrgFeature(session.user.id, "exports");

  const { id } = await params;
  const report = await prisma.report.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: { id: true, title: true, reportJson: true, type: true },
  });
  if (!report) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const payload = report.reportJson as unknown as InterviewReport;

  const header = [
    "reportId",
    "reportType",
    "interviewId",
    "candidateName",
    "jobTitle",
    "recommendation",
    "overallScore",
    "questionOrder",
    "topic",
    "difficulty",
    "questionType",
    "score",
    "strengthsNotes",
    "weaknessesNotes",
    "overallNotes",
  ];

  const rows: string[] = [];
  rows.push(header.join(","));

  for (const q of payload.questions) {
    const meta = q.evaluation?.metadataJson as { strengthsNotes?: unknown; weaknessesNotes?: unknown } | null;
    const record = [
      report.id,
      report.type,
      payload.interview.id,
      payload.interview.candidate.fullName,
      payload.interview.jobDescription.title,
      payload.scorecard?.recommendation ?? "",
      typeof payload.scorecard?.overallScore === "number" ? payload.scorecard.overallScore : "",
      q.order,
      q.topic ?? "",
      q.difficulty,
      q.type,
      typeof q.evaluation?.score === "number" ? q.evaluation.score : "",
      typeof meta?.strengthsNotes === "string" ? meta.strengthsNotes : "",
      typeof meta?.weaknessesNotes === "string" ? meta.weaknessesNotes : "",
      typeof q.evaluation?.notesText === "string" ? q.evaluation.notesText : "",
    ];
    rows.push(record.map(csvEscape).join(","));
  }

  const body = rows.join("\n");
  const filename = `report-${report.id}.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

