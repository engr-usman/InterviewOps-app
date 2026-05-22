import { RequirementType, SourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type Db = {
  candidate: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  jobDescription: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
};

export type SkillMatchSummary = {
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  focusAreas: string[];
};

function uniqueLower(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export async function computeCandidateVsJobDescriptionMatch({
  candidateId,
  jobDescriptionId,
  organizationId,
}: {
  candidateId: string;
  jobDescriptionId: string;
  organizationId: string;
}): Promise<SkillMatchSummary | null> {
  const db = prisma as unknown as Db;
  const candidate = await db.candidate.findFirst({
    where: { id: candidateId, organizationId },
    select: { id: true },
  });
  if (!candidate) return null;

  const jd = await db.jobDescription.findFirst({
    where: { id: jobDescriptionId, organizationId },
    select: { id: true },
  });
  if (!jd) return null;

  const [candidateSkills, jdReqs] = await Promise.all([
    prisma.candidateSkillMatch.findMany({
      where: { candidateId, sourceType: SourceType.RESUME },
      select: { skill: { select: { name: true } } },
      take: 200,
    }),
    prisma.jobDescriptionSkillRequirement.findMany({
      where: { jobDescriptionId, requirementType: { in: [RequirementType.REQUIRED, RequirementType.PREFERRED] } },
      select: { requirementType: true, skill: { select: { name: true } } },
      take: 300,
    }),
  ]);

  const candidateSet = new Set(candidateSkills.map((s) => s.skill.name.toLowerCase()));
  const required = uniqueLower(jdReqs.filter((r) => r.requirementType === RequirementType.REQUIRED).map((r) => r.skill.name));
  const preferred = uniqueLower(jdReqs.filter((r) => r.requirementType === RequirementType.PREFERRED).map((r) => r.skill.name));
  const totalRequired = required.length;

  const matchedRequired = required.filter((s) => candidateSet.has(s.toLowerCase()));
  const missingRequired = required.filter((s) => !candidateSet.has(s.toLowerCase()));
  const matchedPreferred = preferred.filter((s) => candidateSet.has(s.toLowerCase()));

  const matchPercentage = totalRequired === 0 ? (candidateSet.size > 0 ? 50 : 0) : Math.round((matchedRequired.length / totalRequired) * 100);

  const matchedSkills = uniqueLower([...matchedRequired, ...matchedPreferred]).slice(0, 50);
  const missingSkills = missingRequired.slice(0, 50);
  const strengths = matchedSkills.slice(0, 10);
  const weaknesses = missingSkills.slice(0, 10);
  const focusAreas = missingSkills.slice(0, 8);

  return { matchPercentage, matchedSkills, missingSkills, strengths, weaknesses, focusAreas };
}
