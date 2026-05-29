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

export function buildAiResumeParserPrompt(input: {
  candidateId: string;
  candidateName: string;
  extractedText: string;
  targetRole?: string | null;
}): { system: string; prompt: string } {
  const system =
    "You are a resume parser for a SaaS recruiting product. Return valid JSON only, no markdown. " +
    "Extract only information present in the resume. Do not invent skills or certifications. " +
    "If unsure, return empty arrays/fields instead of guessing.";

  const prompt = JSON.stringify(
    {
      task: "Parse a resume into structured resume analysis.",
      candidate: { id: input.candidateId, name: input.candidateName },
      context: { targetRole: input.targetRole ?? null },
      resumeText: input.extractedText,
      outputSchema: {
        summary: "string",
        candidateTitle: "string|null",
        yearsOfExperience: "string|null",
        seniorityAssessment: "string|null",
        skills: ["string"],
        skillCategories: {
          cloudPlatforms: ["string"],
          awsServices: ["string"],
          azureServices: ["string"],
          gcpServices: ["string"],
          containersOrchestration: ["string"],
          infrastructureAsCode: ["string"],
          cicd: ["string"],
          monitoringLogging: ["string"],
          securityDevSecOps: ["string"],
          databases: ["string"],
          programmingScripting: ["string"],
          sreReliability: ["string"],
          leadershipArchitecture: ["string"],
        },
        certifications: ["string"],
        trainingsCommunity: ["string"],
        leadershipIndicators: ["string"],
        workExperience: [
          { company: "string|null", role: "string|null", startDate: "string|null", endDate: "string|null", highlights: ["string"] },
        ],
        education: ["string"],
        strengths: ["string"],
        possibleConcerns: ["string"],
        suggestedInterviewFocusAreas: ["string"],
        extractionStatus: `"success"|"failed"|"partial"`,
        extractionMethod: `"ai"|"fallback"|"hybrid"`,
        parserWarnings: ["string"],
      },
      constraints: {
        jsonOnly: true,
        maxItemsPerList: 12,
      },
    },
    null,
    2,
  );

  return { system, prompt };
}
