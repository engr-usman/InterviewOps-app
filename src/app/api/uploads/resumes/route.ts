import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNumberSetting } from "@/server/services/app-settings";
import { requireOrgPermission } from "@/server/services/access";
import { parseAndStoreCandidateResume } from "@/server/services/resume-service";

export const runtime = "nodejs";

type Db = {
  candidate: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
};

const allowedExtensions = [".pdf", ".doc", ".docx"] as const;
const allowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

function isAllowedMimeType(mimeType: string): boolean {
  return (allowedMimeTypes as readonly string[]).includes(mimeType);
}

function safeFileBaseName(name: string): string {
  const base = name.replace(/\.[^/.]+$/, "");
  return base
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
  try {
    ctx = await requireOrgPermission(session.user.id, "candidate:manage");
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Forbidden." }, { status: 403 });
  }
  const maxBytes = await getNumberSetting("uploads.maxResumeBytes", 5 * 1024 * 1024);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid multipart upload." }, { status: 400 });
  }

  const candidateId = formData.get("candidateId");
  const file = formData.get("file");

  if (typeof candidateId !== "string" || candidateId.trim() === "") {
    return NextResponse.json({ ok: false, error: "Missing candidateId." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file." }, { status: 400 });
  }

  const originalName = file.name || "resume";
  const ext = path.extname(originalName).toLowerCase();
  if (!(allowedExtensions as readonly string[]).includes(ext)) {
    return NextResponse.json({ ok: false, error: "Only PDF/DOC/DOCX are supported." }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (mimeType !== "application/octet-stream" && !isAllowedMimeType(mimeType)) {
    return NextResponse.json({ ok: false, error: "Unsupported file type." }, { status: 400 });
  }

  if (file.size > maxBytes) {
    return NextResponse.json(
      { ok: false, error: `File too large. Max size is ${Math.floor(maxBytes / (1024 * 1024))}MB.` },
      { status: 400 },
    );
  }

  const db = prisma as unknown as Db;
  const candidate = await db.candidate.findFirst({
    where: { id: candidateId, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!candidate) return NextResponse.json({ ok: false, error: "Candidate not found." }, { status: 404 });

  const userDir = path.join(process.cwd(), "public", "uploads", "resumes", session.user.id);
  await mkdir(userDir, { recursive: true });

  const base = safeFileBaseName(originalName);
  const fileName = `${candidateId}-${Date.now()}-${base}${ext}`;
  const absolutePath = path.join(userDir, fileName);
  const urlPath = `/uploads/resumes/${session.user.id}/${fileName}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  await db.candidate.updateMany({
    where: { id: candidateId, organizationId: ctx.organization.id },
    data: {
      resumeFileUrl: urlPath,
      resumeFileName: originalName,
      resumeMimeType: mimeType,
      resumeUploadedAt: new Date(),
    },
  });

  try {
    const parsed = await parseAndStoreCandidateResume({
      candidateId,
      organizationId: ctx.organization.id,
      absoluteFilePath: absolutePath,
      mimeType,
      fileName: originalName,
    });
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/candidates");
    if (!parsed.parsed) {
      return NextResponse.json({
        ok: true,
        data: {
          resumeFileUrl: urlPath,
          resumeFileName: originalName,
          resumeMimeType: mimeType,
          parsed: false,
        },
        warning: parsed.warning ?? "Uploaded, but parsing failed.",
      });
    }
  } catch {
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/candidates");
    return NextResponse.json({
      ok: true,
      data: {
        resumeFileUrl: urlPath,
        resumeFileName: originalName,
        resumeMimeType: mimeType,
        parsed: false,
      },
      warning: "Uploaded, but parsing failed.",
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      resumeFileUrl: urlPath,
      resumeFileName: originalName,
      resumeMimeType: mimeType,
      parsed: true,
    },
  });
}
