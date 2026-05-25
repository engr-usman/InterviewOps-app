import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgFeature, requireOrgPermission } from "@/server/services/access";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  let ctx: Awaited<ReturnType<typeof requireOrgFeature>>;
  try {
    await requireOrgPermission(session.user.id, "reports:view");
    ctx = await requireOrgFeature(session.user.id, "exports");
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const report = await prisma.report.findFirst({
    where: { id, organizationId: ctx.organization.id },
    select: { id: true, title: true, reportJson: true, type: true, createdAt: true, updatedAt: true },
  });
  if (!report) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const body = JSON.stringify(
    {
      id: report.id,
      type: report.type,
      title: report.title,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      report: report.reportJson,
    },
    null,
    2,
  );

  const filename = `report-${report.id}.json`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
