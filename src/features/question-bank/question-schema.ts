import { DifficultyLevel, QuestionType, SeniorityLevel, SourceType } from "@prisma/client";
import { z } from "zod";

export const questionFormInputSchema = z.object({
  topic: z.string().trim().min(1, "Topic is required."),
  prompt: z.string().trim().min(1, "Prompt is required."),
  type: z.nativeEnum(QuestionType),
  difficulty: z.nativeEnum(DifficultyLevel),
  seniorityLevel: z.union([z.nativeEnum(SeniorityLevel), z.literal("")]).optional(),
  sourceType: z.union([z.nativeEnum(SourceType), z.literal("")]).optional(),
  tags: z.union([z.string(), z.literal("")]).optional(),
});

export type QuestionFormInputValues = z.infer<typeof questionFormInputSchema>;

export type QuestionFormValues = {
  topic: string;
  prompt: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  seniorityLevel?: SeniorityLevel;
  sourceType?: SourceType;
  tags?: string[];
};

export function normalizeQuestionFormValues(input: QuestionFormInputValues): QuestionFormValues {
  const topic = input.topic.trim();
  const prompt = input.prompt.trim();

  const tags =
    input.tags && input.tags.trim() !== ""
      ? Array.from(
          new Set(
            input.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          ),
        )
      : undefined;

  return {
    topic,
    prompt,
    type: input.type,
    difficulty: input.difficulty,
    seniorityLevel: input.seniorityLevel ? input.seniorityLevel : undefined,
    sourceType: input.sourceType ? input.sourceType : undefined,
    tags,
  };
}

export const difficultyOptions: Array<{ label: string; value: DifficultyLevel }> = [
  { label: "Beginner", value: "BEGINNER" },
  { label: "Junior", value: "JUNIOR" },
  { label: "Mid-level", value: "MID_LEVEL" },
  { label: "Senior", value: "SENIOR" },
  { label: "Lead", value: "LEAD" },
  { label: "Head Architect", value: "HEAD_ARCHITECT" },
];

export const seniorityOptions: Array<{ label: string; value: SeniorityLevel }> = [
  { label: "Intern", value: "INTERN" },
  { label: "Junior", value: "JUNIOR" },
  { label: "Mid", value: "MID" },
  { label: "Senior", value: "SENIOR" },
  { label: "Staff", value: "STAFF" },
  { label: "Principal", value: "PRINCIPAL" },
];

export const questionTypeOptions: Array<{ label: string; value: QuestionType }> = [
  { label: "Fixed", value: "FIXED" },
  { label: "AI generated", value: "AI_GENERATED" },
  { label: "Follow-up", value: "FOLLOW_UP" },
];

export const sourceTypeOptions: Array<{ label: string; value: SourceType }> = [
  { label: "Manual", value: "MANUAL" },
  { label: "AI", value: "AI" },
  { label: "Resume", value: "RESUME" },
  { label: "Job description", value: "JOB_DESCRIPTION" },
];
