export function buildInterviewSummaryPrompt(input: {
  candidateName: string;
  jobTitle: string;
  technicalAverage: number | null;
  recommendation?: string | null;
  evaluatedQuestions: Array<{ topic: string | null; questionText: string; score: number | null }>;
}): { system: string; prompt: string } {
  const system =
    "You are an interview assistant. Generate a concise interview summary and recommendation reasoning. " +
    "Return valid JSON only, no markdown.";

  const prompt = JSON.stringify(
    {
      task: "Generate interview summary and recommendation reasoning.",
      context: {
        candidateName: input.candidateName,
        jobTitle: input.jobTitle,
        technicalAverage: input.technicalAverage,
        recommendation: input.recommendation ?? null,
        evaluatedQuestions: input.evaluatedQuestions,
      },
      outputSchema: {
        interviewSummary: "string",
        strengthsSummary: ["string"],
        weaknessesSummary: ["string"],
        hiringRecommendationReasoning: "string",
        finalVerdictExplanation: "string",
        suggestedRecommendation: "string enum or null",
      },
      constraints: { maxBulletsPerList: 6 },
    },
    null,
    2,
  );

  return { system, prompt };
}

