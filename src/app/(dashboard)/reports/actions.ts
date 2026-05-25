"use server";

import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { generateAndUpsertInterviewReport } from "@/server/reports/report-service";
import { requireOrgPermission } from "@/server/services/access";
import { ReportType } from "@prisma/client";

export async function generateInterviewReportAndRedirectAction(formData: FormData) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await requireOrgPermission(session.user.id, "reports:view");

  const interviewId = String(formData.get("interviewId") ?? "");
  const typeRaw = String(formData.get("type") ?? "FULL");
  const forceRaw = String(formData.get("force") ?? "0");
  const returnTo = String(formData.get("returnTo") ?? "/reports");

  const type =
    typeRaw === "FULL" || typeRaw === "FEEDBACK" || typeRaw === "SUMMARY" || typeRaw === "SCORECARD"
      ? (typeRaw as ReportType)
      : ReportType.FULL;
  const force = forceRaw === "1";

  if (!interviewId) redirect(returnTo);

  try {
    const result = await generateAndUpsertInterviewReport({
      interviewId,
      organizationId: ctx.organization.id,
      userId: session.user.id,
      type,
      force,
    });
    redirect(`/reports/${result.id}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to generate report.";
    const sep = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${sep}reportError=${encodeURIComponent(msg)}`);
  }
}

