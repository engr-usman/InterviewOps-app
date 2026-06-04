import { DifficultyLevel, QuestionType, SeniorityLevel, SourceType } from "@prisma/client";
import { z } from "zod";

export const questionVisibilitySchema = z.enum(["PRIVATE", "ORGANIZATION"]);
export type QuestionVisibility = z.infer<typeof questionVisibilitySchema>;

export const questionFormInputSchema = z.object({
  domain: z.string().trim().min(1, "Domain is required."),
  subDomain: z.union([z.string().trim().min(1), z.literal("")]).optional(),
  topic: z.string().trim().min(1, "Topic is required."),
  prompt: z.string().trim().min(1, "Prompt is required."),
  evaluationGuideText: z.union([z.string(), z.literal("")]).optional(),
  type: z.nativeEnum(QuestionType),
  difficulty: z.nativeEnum(DifficultyLevel),
  seniorityLevel: z.union([z.nativeEnum(SeniorityLevel), z.literal("")]).optional(),
  sourceType: z.union([z.nativeEnum(SourceType), z.literal("")]).optional(),
  tags: z.union([z.string(), z.literal("")]).optional(),
  visibility: questionVisibilitySchema,
});

export type QuestionFormInputValues = z.infer<typeof questionFormInputSchema>;

export type QuestionFormValues = {
  domain: string;
  subDomain?: string;
  topic: string;
  prompt: string;
  evaluationGuideText?: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  seniorityLevel?: SeniorityLevel;
  sourceType?: SourceType;
  tags?: string[];
  visibility: QuestionVisibility;
};

export function normalizeQuestionFormValues(input: QuestionFormInputValues): QuestionFormValues {
  const domain = input.domain.trim();
  const subDomain = input.subDomain && input.subDomain.trim() !== "" ? input.subDomain.trim() : undefined;
  const topic = input.topic.trim();
  const prompt = input.prompt.trim();
  const evaluationGuideText =
    input.evaluationGuideText && input.evaluationGuideText.trim() !== "" ? input.evaluationGuideText.trim() : undefined;

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
    domain,
    subDomain,
    topic,
    prompt,
    evaluationGuideText,
    type: input.type,
    difficulty: input.difficulty,
    seniorityLevel: input.seniorityLevel ? input.seniorityLevel : undefined,
    sourceType: input.sourceType ? input.sourceType : undefined,
    tags,
    visibility: input.visibility,
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

export const domainOptions = [
  "Cloud Computing",
  "DevOps",
  "SRE / Observability",
  "Cloud/Infrastructure",
  "Other",
] as const;

export type DomainOption = (typeof domainOptions)[number];

export const subDomainsByDomain: Record<DomainOption, string[]> = {
  "Cloud Computing": ["AWS", "Azure", "GCP", "Multi-cloud", "Other"],
  DevOps: ["Linux", "Docker", "Kubernetes", "Terraform", "CI/CD", "Jenkins", "GitHub Actions", "Ansible", "Other"],
  "SRE / Observability": ["Prometheus", "Grafana", "Monitoring", "Incident Response", "SLO/SLA", "Reliability", "Other"],
  "Cloud/Infrastructure": ["Networking", "Security", "IAM", "Compute", "Storage", "Other"],
  Other: ["Other"],
};

export const visibilityOptions: Array<{ label: string; value: QuestionVisibility }> = [
  { label: "Private to me", value: "PRIVATE" },
  { label: "Shared with organization", value: "ORGANIZATION" },
];
