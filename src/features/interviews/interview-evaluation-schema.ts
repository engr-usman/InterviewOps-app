import { z } from "zod";

export const evaluationStatusValues = ["PENDING", "IN_REVIEW", "EVALUATED"] as const;
export type EvaluationStatus = (typeof evaluationStatusValues)[number];

const requiredScore = z
  .union([z.number().int().min(1).max(10), z.nan()])
  .refine((v) => typeof v === "number" && !Number.isNaN(v), { message: "Required." });

const requiredNotes = z
  .union([z.string(), z.literal("")])
  .optional()
  .refine((v) => typeof v === "string" && v.trim().length > 0, { message: "Required." });

export const saveQuestionEvaluationSchema = z.object({
  score: requiredScore,
  status: z.enum(evaluationStatusValues),
  strengthsNotes: requiredNotes,
  weaknessesNotes: requiredNotes,
  overallNotes: requiredNotes,
});

export type SaveQuestionEvaluationValues = z.infer<typeof saveQuestionEvaluationSchema>;

export const saveScorecardSchema = z.object({
  communicationScore: requiredScore,
  problemSolvingScore: requiredScore,
  interviewerTechnicalAssessment: requiredScore,
  interviewSummary: requiredNotes,
  finalRecommendation: requiredNotes,
  hiringConcerns: requiredNotes,
  strongAreas: requiredNotes,
});

export type SaveScorecardValues = z.infer<typeof saveScorecardSchema>;
