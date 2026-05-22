import { Priority, RequirementType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createAiProvider } from "@/lib/ai/provider";
import { getBooleanSetting, getStringSetting } from "@/server/services/app-settings";
import { slugifySkillName, uniqueStrings, upsertSkillsByName } from "@/server/services/skill-utils";

export type ParsedJdJson = {
  summary?: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  cloudPlatforms: string[];
  tools: string[];
  certifications: string[];
  experienceRequirements?: string;
  parser: {
    provider: string;
    analyzedAt: string;
    version: string;
  };
};

function compactWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function pickListMatches(text: string, dictionary: string[]): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const item of dictionary) {
    if (lower.includes(item.toLowerCase())) found.push(item);
  }
  return uniqueStrings(found);
}

function extractBullets(text: string, max = 30): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bullets = lines
    .filter((l) => /^[-•*]\s+/.test(l))
    .map((l) => l.replace(/^[-•*]\s+/, "").trim())
    .filter(Boolean);

  return bullets.slice(0, max);
}

function extractExperienceRequirement(text: string): string | undefined {
  const m = text.match(/(\d{1,2}\+?)\s+years?\s+(of\s+)?experience/i);
  if (!m) return undefined;
  return `${m[1]} years experience`;
}

function parseJdMock(title: string, descriptionText: string | null, requirementsText: string | null): ParsedJdJson {
  const combined = compactWhitespace([title, descriptionText ?? "", requirementsText ?? ""].join("\n"));
  const analyzedAt = new Date().toISOString();

  const cloudPlatforms = pickListMatches(combined, ["AWS", "GCP", "Azure"]);
  const tools = pickListMatches(combined, [
    "Kubernetes",
    "Docker",
    "Terraform",
    "PostgreSQL",
    "Redis",
    "Kafka",
    "Node.js",
    "React",
    "Next.js",
    "TypeScript",
    "Python",
    "Java",
    "Go",
  ]);
  const certifications = pickListMatches(combined, ["AWS Certified", "CKA", "CKAD", "PMP", "Security+"]);

  const bullets = extractBullets(descriptionText ?? "");
  const responsibilities = bullets.length > 0 ? bullets : extractBullets(requirementsText ?? "");

  const requiredSkills = uniqueStrings([
    ...pickListMatches(combined, ["System Design", "API Design", "Microservices", "SQL", "CI/CD", "Testing"]),
    ...cloudPlatforms,
    ...tools,
  ]).slice(0, 60);

  const preferredSkills = uniqueStrings([
    ...pickListMatches(combined, ["Observability", "Security", "Distributed Systems", "NoSQL"]),
  ]).slice(0, 40);

  const experienceRequirements = extractExperienceRequirement(combined);

  return {
    responsibilities,
    requiredSkills,
    preferredSkills,
    cloudPlatforms,
    tools,
    certifications,
    experienceRequirements,
    parser: { provider: "mock", analyzedAt, version: "1" },
  };
}

async function buildJdJson(title: string, descriptionText: string | null, requirementsText: string | null) {
  const parsed = parseJdMock(title, descriptionText, requirementsText);

  const provider = await getStringSetting("ai.provider", "mock");
  const ai = createAiProvider({ provider: provider === "openai" || provider === "gemini" || provider === "claude" ? provider : "mock" });

  const prompt = `Summarize this job description in 2-3 sentences for interview preparation.\n\nTitle: ${title}\n\nDescription:\n${descriptionText ?? ""}\n\nRequirements:\n${requirementsText ?? ""}`;
  const resp = await ai.generateText({ prompt });

  return {
    ...parsed,
    summary: resp.text,
    parser: { ...parsed.parser, provider: ai.id },
  } satisfies ParsedJdJson;
}

export async function analyzeAndStoreJobDescription({
  jobDescriptionId,
  userId,
}: {
  jobDescriptionId: string;
  userId: string;
}) {
  const enabled = await getBooleanSetting("jdAnalysis.enabled", true);
  if (!enabled) return;

  const jd = await prisma.jobDescription.findFirst({
    where: { id: jobDescriptionId, createdById: userId },
    select: { id: true, title: true, descriptionText: true, requirementsText: true },
  });
  if (!jd) throw new Error("Job description not found.");

  const parsedJdJson = await buildJdJson(jd.title, jd.descriptionText, jd.requirementsText);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const requiredSkillNames = uniqueStrings(parsedJdJson.requiredSkills);
    const preferredSkillNames = uniqueStrings(parsedJdJson.preferredSkills);

    const skillRows = await upsertSkillsByName(tx, [...requiredSkillNames, ...preferredSkillNames]);
    const idBySlug = new Map(skillRows.map((s) => [s.slug, s.id]));

    const requiredSkillIds = requiredSkillNames
      .map((n) => idBySlug.get(slugifySkillName(n)))
      .filter((id): id is string => typeof id === "string");
    const preferredSkillIds = preferredSkillNames
      .map((n) => idBySlug.get(slugifySkillName(n)))
      .filter((id): id is string => typeof id === "string");

    await tx.jobDescription.update({
      where: { id: jobDescriptionId },
      data: { parsedJdJson: parsedJdJson as never },
    });

    await tx.jobDescriptionSkillRequirement.deleteMany({
      where: { jobDescriptionId, requirementType: { in: [RequirementType.REQUIRED, RequirementType.PREFERRED] } },
    });

    const createRows: Array<Prisma.JobDescriptionSkillRequirementCreateManyInput> = [
      ...requiredSkillIds.map((skillId) => ({
        jobDescriptionId,
        skillId,
        requirementType: RequirementType.REQUIRED,
        priority: Priority.MEDIUM,
      })),
      ...preferredSkillIds.map((skillId) => ({
        jobDescriptionId,
        skillId,
        requirementType: RequirementType.PREFERRED,
        priority: Priority.MEDIUM,
      })),
    ];

    if (createRows.length > 0) {
      await tx.jobDescriptionSkillRequirement.createMany({
        data: createRows,
        skipDuplicates: true,
      });
    }
  });
}

