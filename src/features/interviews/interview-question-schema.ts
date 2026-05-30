import { DifficultyLevel, QuestionType, SeniorityLevel } from "@prisma/client";
import { z } from "zod";

const emptyToUndefined = <T>(value: T) => (value === "" ? undefined : value);

export const generateQuestionsFormSchema = z.object({
  count: z.number().int().min(1).max(20),
  topic: z.union([z.string(), z.literal("")]).optional(),
  difficulty: z.union([z.nativeEnum(DifficultyLevel), z.literal("")]).optional(),
  seniorityLevel: z.union([z.nativeEnum(SeniorityLevel), z.literal("")]).optional(),
  type: z.union([z.nativeEnum(QuestionType), z.literal("")]).optional(),
});

export type GenerateQuestionsFormValues = z.infer<typeof generateQuestionsFormSchema>;

export const generateQuestionsSchema = z.object({
  count: z.number().int().min(1).max(20),
  topic: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  difficulty: z.preprocess(emptyToUndefined, z.nativeEnum(DifficultyLevel).optional()),
  seniorityLevel: z.preprocess(emptyToUndefined, z.nativeEnum(SeniorityLevel).optional()),
  type: z.preprocess(emptyToUndefined, z.nativeEnum(QuestionType).optional()),
});

export type GenerateQuestionsValues = z.infer<typeof generateQuestionsSchema>;

export const addQuestionSchema = z.object({
  questionBankId: z.string().trim().min(1, "Select a question."),
});

export type AddQuestionValues = z.infer<typeof addQuestionSchema>;

export const addAdHocQuestionSchema = z.object({
  questionText: z.string().trim().min(5, "Question text is required."),
  topic: z.union([z.string().trim().min(1), z.literal("")]).optional(),
  difficulty: z.union([z.nativeEnum(DifficultyLevel), z.literal("")]).optional(),
});

export type AddAdHocQuestionValues = z.infer<typeof addAdHocQuestionSchema>;
