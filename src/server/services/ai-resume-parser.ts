import { z } from "zod";

import { createAiProvider } from "@/lib/ai/provider";
import { buildAiResumeParserPrompt } from "@/lib/ai/prompts/resume-analysis.prompt";
import { getBooleanSetting, getStringSetting } from "@/server/services/app-settings";

const SkillCategoriesSchema = z.object({
  cloudPlatforms: z.array(z.string()).default([]),
  awsServices: z.array(z.string()).default([]),
  azureServices: z.array(z.string()).default([]),
  gcpServices: z.array(z.string()).default([]),
  containersOrchestration: z.array(z.string()).default([]),
  infrastructureAsCode: z.array(z.string()).default([]),
  cicd: z.array(z.string()).default([]),
  monitoringLogging: z.array(z.string()).default([]),
  securityDevSecOps: z.array(z.string()).default([]),
  databases: z.array(z.string()).default([]),
  programmingScripting: z.array(z.string()).default([]),
  sreReliability: z.array(z.string()).default([]),
  leadershipArchitecture: z.array(z.string()).default([]),
});

const WorkExperienceItemSchema = z.object({
  company: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  highlights: z.array(z.string()).optional().default([]),
});

export const ResumeAnalysisSchema = z.object({
  summary: z.string(),
  candidateTitle: z.string().nullable().optional(),
  yearsOfExperience: z.string().nullable().optional(),
  seniorityAssessment: z.string().nullable().optional(),
  skills: z.array(z.string()).default([]),
  skillCategories: SkillCategoriesSchema,
  certifications: z.array(z.string()).default([]),
  trainingsCommunity: z.array(z.string()).default([]),
  leadershipIndicators: z.array(z.string()).default([]),
  workExperience: z.array(WorkExperienceItemSchema).default([]),
  education: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  possibleConcerns: z.array(z.string()).default([]),
  suggestedInterviewFocusAreas: z.array(z.string()).default([]),
  extractionStatus: z.enum(["success", "failed", "partial"]),
  extractionMethod: z.enum(["ai", "fallback", "hybrid"]),
  parserWarnings: z.array(z.string()).default([]),
});

export type ResumeAnalysis = z.infer<typeof ResumeAnalysisSchema>;

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function repairJsonOnce(input: string): string | null {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = input.slice(start, end + 1);
  return slice.trim();
}

function uniqueStrings(values: string[]): string[] {
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

function normalizeResumeAnalysis(input: ResumeAnalysis): ResumeAnalysis {
  const categories = input.skillCategories;
  const normalizedCategories = {
    cloudPlatforms: uniqueStrings(categories.cloudPlatforms),
    awsServices: uniqueStrings(categories.awsServices),
    azureServices: uniqueStrings(categories.azureServices),
    gcpServices: uniqueStrings(categories.gcpServices),
    containersOrchestration: uniqueStrings(categories.containersOrchestration),
    infrastructureAsCode: uniqueStrings(categories.infrastructureAsCode),
    cicd: uniqueStrings(categories.cicd),
    monitoringLogging: uniqueStrings(categories.monitoringLogging),
    securityDevSecOps: uniqueStrings(categories.securityDevSecOps),
    databases: uniqueStrings(categories.databases),
    programmingScripting: uniqueStrings(categories.programmingScripting),
    sreReliability: uniqueStrings(categories.sreReliability),
    leadershipArchitecture: uniqueStrings(categories.leadershipArchitecture),
  };

  return {
    ...input,
    summary: input.summary.trim(),
    candidateTitle: input.candidateTitle?.trim() ? input.candidateTitle.trim() : null,
    yearsOfExperience: input.yearsOfExperience?.trim() ? input.yearsOfExperience.trim() : null,
    seniorityAssessment: input.seniorityAssessment?.trim() ? input.seniorityAssessment.trim() : null,
    skills: uniqueStrings(input.skills),
    skillCategories: normalizedCategories,
    certifications: uniqueStrings(input.certifications),
    trainingsCommunity: uniqueStrings(input.trainingsCommunity),
    leadershipIndicators: uniqueStrings(input.leadershipIndicators),
    education: uniqueStrings(input.education),
    strengths: uniqueStrings(input.strengths),
    possibleConcerns: uniqueStrings(input.possibleConcerns),
    suggestedInterviewFocusAreas: uniqueStrings(input.suggestedInterviewFocusAreas),
    parserWarnings: uniqueStrings(input.parserWarnings),
    workExperience: input.workExperience.slice(0, 25),
  };
}

export async function parseResumeWithAiIfEnabled(input: {
  candidateId: string;
  candidateName: string;
  extractedText: string;
  targetRole?: string | null;
}): Promise<{ ok: true; analysis: ResumeAnalysis } | { ok: false; error: string }> {
  const aiEnabled = await getBooleanSetting("ai.enabled", false);
  const resumeAiEnabled = await getBooleanSetting("resumeParsing.aiResumeParser.enabled", false);
  if (!aiEnabled || !resumeAiEnabled) return { ok: false, error: "AI resume parsing is disabled." };

  const debug = process.env.RESUME_PARSING_DEBUG === "1" || process.env.NODE_ENV !== "production";
  const providerSetting = await getStringSetting("ai.provider", "mock");
  const provider =
    providerSetting === "openai" || providerSetting === "gemini" || providerSetting === "claude" ? providerSetting : "mock";

  const ai = createAiProvider({ provider, apiKey: undefined });

  const { system, prompt } = buildAiResumeParserPrompt({
    candidateId: input.candidateId,
    candidateName: input.candidateName,
    extractedText: input.extractedText,
    targetRole: input.targetRole ?? null,
  });

  if (debug) {
    console.info(
      `[ai-resume-parser] start candidateId=${input.candidateId} provider=${ai.id} textLen=${input.extractedText.length}`,
    );
  }

  let respText: string;
  try {
    const resp = await ai.generateText({ system, prompt });
    respText = resp.text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI parser failed.";
    if (debug) console.info(`[ai-resume-parser] failed candidateId=${input.candidateId} err=${msg}`);
    return { ok: false, error: msg };
  }

  const parsed = safeJsonParse(respText) ?? (repairJsonOnce(respText) ? safeJsonParse(repairJsonOnce(respText)!) : null);
  if (!parsed) return { ok: false, error: "AI resume parser returned invalid JSON." };

  const validated = ResumeAnalysisSchema.safeParse(parsed);
  if (!validated.success) return { ok: false, error: "AI resume parser response did not match schema." };

  const normalized = normalizeResumeAnalysis(validated.data);
  if (debug) {
    console.info(
      `[ai-resume-parser] ok candidateId=${input.candidateId} skills=${normalized.skills.length} certs=${normalized.certifications.length} method=${normalized.extractionMethod}`,
    );
  }

  return { ok: true, analysis: normalized };
}
