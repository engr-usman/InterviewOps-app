import { Recommendation } from "@prisma/client";
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

export const saveScorecardSchema = z.object({
  recommendation: z.union([z.nativeEnum(Recommendation), z.literal("")]).optional(),
  communicationScore: z.union([z.number().int().min(1).max(10), z.nan()]).optional(),
  problemSolvingScore: z.union([z.number().int().min(1).max(10), z.nan()]).optional(),
  cloudDevOpsScore: z.union([z.number().int().min(1).max(10), z.nan()]).optional(),
  interviewSummary: z.union([z.string(), z.literal("")]).optional(),
  finalRecommendation: z.union([z.string(), z.literal("")]).optional(),
  hiringConcerns: z.union([z.string(), z.literal("")]).optional(),
  strongAreas: z.union([z.string(), z.literal("")]).optional(),
});

export type SaveScorecardValues = z.infer<typeof saveScorecardSchema>;

