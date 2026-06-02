export type ReportFormat = "json" | "csv" | "pdf";

export type ReportKind = "interview" | "candidate" | "scorecard";

export type BaseReport = {
  kind: ReportKind;
  generatedAt: string;
  generatedByUserId: string;
  version: string;
};

export type InterviewReport = BaseReport & {
  kind: "interview";
  generatedBy?: {
    userId: string;
    name: string;
    role: string;
  };
  candidateSummary?: string | null;
  jobDescriptionSummary?: string | null;
  interview: {
    id: string;
    status: string;
    candidate: { id: string; fullName: string };
    jobDescription: { id: string; title: string };
  };
  scorecard: {
    recommendation: string | null;
    overallScore: number | null;
    summaryText: string | null;
    scorecardJson: unknown;
  } | null;
  questions: Array<{
    id: string;
    order: number;
    topic: string | null;
    difficulty: string;
    type: string;
    questionText: string;
    evaluation: { score: number | null; notesText: string | null; metadataJson: unknown } | null;
  }>;
  warnings?: string[];
  details?: {
    candidateSummary?: string | null;
    jobDescriptionSummary?: string | null;
    strengths: string[];
    weaknesses: string[];
    interviewerStrongAreas?: string | null;
    interviewerConcerns?: string | null;
    interviewerFinalNotes?: string | null;
    evaluationBreakdown?: {
      technicalAverage: number | null;
      communication: number | null;
      problemSolving: number | null;
      interviewerTechnicalAssessment: number | null;
      cloudDevOps?: number | null;
      overallScore: number | null;
      recommendation: string | null;
      autoRecommendation: string | null;
      manualOverride: boolean;
    };
    sourceHints?: {
      resumeParsed?: boolean;
      jdParsed?: boolean;
      aiSummaryApplied?: boolean;
    };
  };
};
