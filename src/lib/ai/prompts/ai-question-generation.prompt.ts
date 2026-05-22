export type AiQuestionStyle = "conceptual" | "troubleshooting" | "scenario-based" | "architecture" | "incident-response";

export function buildAiQuestionGenerationPrompt(input: {
  count: number;
  focusArea?: string | null;
  difficulty?: string | null;
  seniority?: string | null;
  style?: AiQuestionStyle | null;
  candidateName: string;
  candidateParsedResume?: unknown | null;
  jobDescriptionTitle: string;
  jobDescriptionParsed?: unknown | null;
  existingInterviewQuestions: Array<{ topic: string | null; questionText: string }>;
  questionBankExamples: Array<{ topic: string; prompt: string; difficulty: string }>;
}): { system: string; prompt: string } {
  const system =
    "You generate realistic DevOps/SRE/Cloud interview questions. Return valid JSON only, no markdown. " +
    "Questions must be specific, practical, and non-repetitive.";

  const prompt = JSON.stringify(
    {
      task: "Generate interview questions.",
      inputs: {
        count: input.count,
        focusArea: input.focusArea ?? null,
        difficulty: input.difficulty ?? null,
        seniority: input.seniority ?? null,
        style: input.style ?? null,
      },
      context: {
        candidateName: input.candidateName,
        candidateParsedResume: input.candidateParsedResume ?? null,
        jobDescriptionTitle: input.jobDescriptionTitle,
        jobDescriptionParsed: input.jobDescriptionParsed ?? null,
        existingInterviewQuestions: input.existingInterviewQuestions,
        questionBankExamples: input.questionBankExamples,
      },
      outputSchema: {
        questions: [
          {
            topic: "string",
            difficulty: "string",
            questionText: "string",
            tags: ["string"],
          },
        ],
      },
      constraints: {
        avoidDuplicatesAgainstExisting: true,
        maxTags: 6,
      },
    },
    null,
    2,
  );

  return { system, prompt };
}

