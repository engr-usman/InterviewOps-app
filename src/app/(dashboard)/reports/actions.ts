"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { getServerAuthSession } from "@/auth";
import { generateAndUpsertInterviewReport } from "@/server/reports/report-service";
import { requireOrgPermission } from "@/server/services/access";
import { ReportType } from "@prisma/client";

export async function generateInterviewReportAndRedirectAction(formData: FormData) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  const interviewId = String(formData.get("interviewId") ?? "");
  const typeRaw = String(formData.get("type") ?? "FULL");
  const forceRaw = String(formData.get("force") ?? "0");
  const returnTo = String(formData.get("returnTo") ?? "/reports");

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "reports:generate");
  } catch {
    const sep = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${sep}reportError=${encodeURIComponent("You do not have permission to generate reports.")}`);
  }

  const type =
    typeRaw === "FULL" || typeRaw === "FEEDBACK" || typeRaw === "SUMMARY" || typeRaw === "SCORECARD"
      ? (typeRaw as ReportType)
      : ReportType.FULL;
  const force = forceRaw === "1";

  if (!interviewId) redirect(returnTo);

  let reportId: string;
  try {
    const result = await generateAndUpsertInterviewReport({
      interviewId,
      organizationId: ctx.organization.id,
      userId: session.user.id,
      type,
      force,
    });
    reportId = result.id;
  } catch (e) {
    if (isRedirectError(e)) throw e;
    const msg = "Unable to regenerate report. Please try again.";
    const sep = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${sep}reportError=${encodeURIComponent(msg)}`);
  }

  redirect(`/reports/${reportId}`);
}
