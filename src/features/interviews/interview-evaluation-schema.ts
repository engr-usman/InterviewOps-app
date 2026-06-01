import { z } from "zod";

export const evaluationStatusValues = ["PENDING", "IN_REVIEW", "EVALUATED"] as const;
export type EvaluationStatus = (typeof evaluationStatusValues)[number];

export const saveQuestionEvaluationSchema = z.object({
  score: z.union([z.number().int().min(1).max(10), z.nan()]).optional(),
  status: z.enum(evaluationStatusValues),
  strengthsNotes: z.union([z.string(), z.literal("")]).optional(),
  weaknessesNotes: z.union([z.string(), z.literal("")]).optional(),
  overallNotes: z.union([z.string(), z.literal("")]).optional(),
});

export type SaveQuestionEvaluationValues = z.infer<typeof saveQuestionEvaluationSchema>;

const requiredScore = z
  .union([z.number().int().min(1).max(10), z.nan()])
  .refine((v) => typeof v === "number" && !Number.isNaN(v), { message: "Required." });

export const saveScorecardSchema = z.object({
  communicationScore: requiredScore,
  problemSolvingScore: requiredScore,
  interviewerTechnicalAssessment: requiredScore,
  interviewSummary: z.union([z.string(), z.literal("")]).optional(),
  finalRecommendation: z.union([z.string(), z.literal("")]).optional(),
  hiringConcerns: z.union([z.string(), z.literal("")]).optional(),
  strongAreas: z.union([z.string(), z.literal("")]).optional(),
});

export type SaveScorecardValues = z.infer<typeof saveScorecardSchema>;
