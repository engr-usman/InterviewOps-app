export function buildFollowUpPrompt(input: {
  currentQuestionText: string;
  currentTopic?: string | null;
  evaluationNotes?: {
    strengthsNotes?: string | null;
    weaknessesNotes?: string | null;
    overallNotes?: string | null;
    score?: number | null;
  } | null;
  candidateParsedResume?: unknown | null;
  jobDescriptionParsed?: unknown | null;
}): { system: string; prompt: string } {
  const system =
    "You are an interview assistant. Generate probing follow-up questions for DevOps/SRE/Cloud interviews. " +
    "Return valid JSON only, no markdown.";

  const prompt = JSON.stringify(
    {
      task: "Suggest 3 follow-up questions that probe depth and clarity.",
      context: {
        currentTopic: input.currentTopic ?? null,
        currentQuestionText: input.currentQuestionText,
        evaluationNotes: input.evaluationNotes ?? null,
        candidateParsedResume: input.candidateParsedResume ?? null,
        jobDescriptionParsed: input.jobDescriptionParsed ?? null,
      },
      outputSchema: {
        followUps: [
          {
            questionText: "string",
            intent: "string",
            tags: ["string"],
          },
        ],
      },
      constraints: { count: 3, maxTags: 6 },
    },
    null,
    2,
  );

  return { system, prompt };
}

