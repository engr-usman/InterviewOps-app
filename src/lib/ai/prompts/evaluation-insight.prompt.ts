export function buildEvaluationInsightPrompt(input: {
  questionText: string;
  topic?: string | null;
  difficulty?: string | null;
  evaluationNotes?: {
    strengthsNotes?: string | null;
    weaknessesNotes?: string | null;
    overallNotes?: string | null;
  } | null;
  candidateParsedResume?: unknown | null;
  jobDescriptionParsed?: unknown | null;
}): { system: string; prompt: string } {
  const system =
    "You are an interview evaluation assistant. Suggest scoring guidance and signals. " +
    "Return valid JSON only, no markdown. The human interviewer is final authority.";

  const prompt = JSON.stringify(
    {
      task: "Provide evaluation assistance for this interview question.",
      context: {
        questionText: input.questionText,
        topic: input.topic ?? null,
        difficulty: input.difficulty ?? null,
        evaluationNotes: input.evaluationNotes ?? null,
        candidateParsedResume: input.candidateParsedResume ?? null,
        jobDescriptionParsed: input.jobDescriptionParsed ?? null,
      },
      outputSchema: {
        suggestedScore: "number (1-10) or null",
        technicalDepthAssessment: "string",
        missingConcepts: ["string"],
        redFlags: ["string"],
        strongSignals: ["string"],
        confidenceAssessment: "string",
      },
      constraints: { maxBulletsPerList: 6 },
    },
    null,
    2,
  );

  return { system, prompt };
}

