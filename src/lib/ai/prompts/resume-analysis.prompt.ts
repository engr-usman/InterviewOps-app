export function buildResumeAnalysisPrompt(input: {
  candidateName: string;
  candidateSeniorityLevel?: string | null;
  parsedResumeJson?: unknown | null;
  resumeTextPreview?: string | null;
  jobDescriptionTitle?: string | null;
}): { system: string; prompt: string } {
  const system =
    "You are an interview assistant for DevOps/SRE/Cloud roles. Be concise, practical, and specific. " +
    "Return valid JSON only, no markdown.";

  const prompt = JSON.stringify(
    {
      task: "Analyze a candidate profile and produce interview prep insights.",
      candidate: {
        name: input.candidateName,
        seniorityLevel: input.candidateSeniorityLevel ?? null,
      },
      context: {
        jobDescriptionTitle: input.jobDescriptionTitle ?? null,
      },
      parsedResumeJson: input.parsedResumeJson ?? null,
      resumeTextPreview: input.resumeTextPreview ?? null,
      outputSchema: {
        profileSummary: "string",
        strengths: ["string"],
        weaknesses: ["string"],
        likelySeniorityAssessment: "string",
        interviewRiskAreas: ["string"],
        suggestedFocusTopics: ["string"],
      },
      constraints: {
        maxBulletsPerList: 6,
      },
    },
    null,
    2,
  );

  return { system, prompt };
}

