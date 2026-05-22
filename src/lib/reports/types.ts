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
};

