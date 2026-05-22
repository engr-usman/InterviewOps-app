import { DifficultyLevel, SeniorityLevel } from "@prisma/client";
import { z } from "zod";

export const aiQuestionStyleValues = [
  "conceptual",
  "troubleshooting",
  "scenario-based",
  "architecture",
  "incident-response",
] as const;

export const generateAiQuestionsSchema = z.object({
  count: z.number().int().min(1).max(20),
  focusArea: z.union([z.string(), z.literal("")]).optional(),
  difficulty: z.union([z.nativeEnum(DifficultyLevel), z.literal("")]).optional(),
  seniority: z.union([z.nativeEnum(SeniorityLevel), z.literal("")]).optional(),
  style: z.union([z.enum(aiQuestionStyleValues), z.literal("")]).optional(),
});

export type GenerateAiQuestionsValues = z.infer<typeof generateAiQuestionsSchema>;

