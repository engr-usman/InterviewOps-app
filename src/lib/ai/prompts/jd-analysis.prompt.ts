export function buildJdAnalysisPrompt(input: {
  title: string;
  seniorityLevel?: string | null;
  descriptionText?: string | null;
  requirementsText?: string | null;
  parsedJdJson?: unknown | null;
}): { system: string; prompt: string } {
  const system =
    "You are an interview assistant for DevOps/SRE/Cloud roles. Extract requirements and interview domains. " +
    "Return valid JSON only, no markdown.";

  const prompt = JSON.stringify(
    {
      task: "Analyze a job description and produce interview prep insights.",
      jobDescription: {
        title: input.title,
        seniorityLevel: input.seniorityLevel ?? null,
        descriptionText: input.descriptionText ?? null,
        requirementsText: input.requirementsText ?? null,
      },
      parsedJdJson: input.parsedJdJson ?? null,
      outputSchema: {
        summary: "string",
        keyTechnicalRequirements: ["string"],
        criticalSkills: ["string"],
        expectedCompetencyAreas: ["string"],
        suggestedInterviewDomains: ["string"],
      },
      constraints: { maxBulletsPerList: 8 },
    },
    null,
    2,
  );

  return { system, prompt };
}

