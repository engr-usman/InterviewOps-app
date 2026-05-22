import { SourceType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { createAiProvider } from "@/lib/ai/provider";
import { getBooleanSetting, getStringSetting } from "@/server/services/app-settings";
import { slugifySkillName, uniqueStrings, upsertSkillsByName } from "@/server/services/skill-utils";

export type ParsedResumeJson = {
  summary?: string;
  yearsOfExperience?: number;
  skills: string[];
  cloudPlatforms: string[];
  tools: string[];
  certifications: string[];
  companies: string[];
  education: string[];
  projects: string[];
  rawTextPreview: string;
  parser: {
    provider: string;
    extractedAt: string;
    version: string;
  };
};

function extractTextFallback(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  const stripped = utf8.replace(/\0/g, " ").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
  return stripped.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractYearsOfExperience(text: string): number | undefined {
  const m = text.match(/(\d{1,2})\s*\+?\s*years?\s+(of\s+)?(experience|exp)/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function extractLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function pickListMatches(text: string, dictionary: string[]): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const item of dictionary) {
    const needle = item.toLowerCase();
    if (lower.includes(needle)) found.push(item);
  }
  return uniqueStrings(found);
}

function parseResumeMock(rawText: string): ParsedResumeJson {
  const yearsOfExperience = extractYearsOfExperience(rawText);

  const cloudPlatforms = pickListMatches(rawText, ["AWS", "GCP", "Azure", "Heroku"]);
  const tools = pickListMatches(rawText, [
    "Docker",
    "Kubernetes",
    "Terraform",
    "Pulumi",
    "Git",
    "GitHub Actions",
    "CircleCI",
    "Jenkins",
    "PostgreSQL",
    "MySQL",
    "Redis",
    "MongoDB",
    "Kafka",
    "RabbitMQ",
    "Node.js",
    "React",
    "Next.js",
    "TypeScript",
    "Python",
    "Java",
    "Go",
  ]);

  const certifications = pickListMatches(rawText, [
    "AWS Certified",
    "Solutions Architect",
    "CKA",
    "CKAD",
    "PMP",
    "Security+",
  ]);

  const skills = uniqueStrings([
    ...pickListMatches(rawText, [
      "System Design",
      "API Design",
      "Microservices",
      "Distributed Systems",
      "CI/CD",
      "Testing",
      "Observability",
      "Security",
      "OAuth",
      "SQL",
      "NoSQL",
    ]),
    ...cloudPlatforms,
    ...tools,
  ]).slice(0, 60);

  const lines = extractLines(rawText);
  const companies = uniqueStrings(
    lines
      .filter((l) => /\b(inc|llc|ltd|corp|corporation|company)\b/i.test(l))
      .slice(0, 15),
  );

  const education = uniqueStrings(
    lines
      .filter((l) => /\b(bachelor|master|phd|b\.s\.|m\.s\.|university|college)\b/i.test(l))
      .slice(0, 15),
  );

  const projects = uniqueStrings(
    lines
      .filter((l) => /\b(project|built|implemented|shipped)\b/i.test(l))
      .slice(0, 15),
  );

  const rawTextPreview = rawText.slice(0, 1200);

  const extractedAt = new Date().toISOString();

  return {
    yearsOfExperience,
    skills,
    cloudPlatforms,
    tools,
    certifications,
    companies,
    education,
    projects,
    rawTextPreview,
    parser: { provider: "mock", version: "1", extractedAt },
  };
}

async function buildResumeJson(rawText: string): Promise<ParsedResumeJson> {
  const parsed = parseResumeMock(rawText);
  const provider = await getStringSetting("ai.provider", "mock");
  const ai = createAiProvider({ provider: provider === "openai" || provider === "gemini" || provider === "claude" ? provider : "mock" });

  const resp = await ai.generateText({
    prompt: `Summarize this resume in 2-3 sentences for interview preparation.\n\n${parsed.rawTextPreview}`,
  });

  return {
    ...parsed,
    summary: resp.text,
    parser: { ...parsed.parser, provider: ai.id },
  };
}

export async function parseAndStoreCandidateResume({
  candidateId,
  userId,
  absoluteFilePath,
}: {
  candidateId: string;
  userId: string;
  absoluteFilePath: string;
}) {
  const enabled = await getBooleanSetting("resumeParsing.enabled", true);
  if (!enabled) return;

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, createdById: userId },
    select: { id: true },
  });
  if (!candidate) throw new Error("Candidate not found.");

  const buffer = await readFile(absoluteFilePath);
  const rawText = extractTextFallback(buffer);
  const parsedResumeJson = await buildResumeJson(rawText);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const skills = uniqueStrings([
      ...parsedResumeJson.skills,
      ...parsedResumeJson.cloudPlatforms,
      ...parsedResumeJson.tools,
      ...parsedResumeJson.certifications,
    ]).slice(0, 80);

    const skillRows = await upsertSkillsByName(tx, skills);
    const skillBySlug = new Map(skillRows.map((s) => [s.slug, s.id]));

    await tx.candidateSkillMatch.deleteMany({
      where: { candidateId, sourceType: SourceType.RESUME },
    });

    const matchRows = skills
      .map((name) => {
        const slug = slugifySkillName(name);
        const skillId = slug ? skillBySlug.get(slug) : undefined;
        if (!skillId) return null;
        return { skillId, name };
      })
      .filter((v): v is { skillId: string; name: string } => Boolean(v));

    if (matchRows.length > 0) {
      await tx.candidateSkillMatch.createMany({
        data: matchRows.map((m) => ({
          candidateId,
          skillId: m.skillId,
          sourceType: SourceType.RESUME,
          confidence: 0.75,
        })),
        skipDuplicates: true,
      });
    }

    await tx.candidate.update({
      where: { id: candidateId },
      data: { parsedResumeJson: parsedResumeJson as never },
    });
  });
}
