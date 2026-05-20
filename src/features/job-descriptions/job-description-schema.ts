import { SeniorityLevel } from "@prisma/client";
import { z } from "zod";

export const jobDescriptionFormInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  department: z.union([z.string().trim().max(120), z.literal("")]).optional(),
  location: z.union([z.string().trim().max(120), z.literal("")]).optional(),
  seniorityLevel: z.union([z.nativeEnum(SeniorityLevel), z.literal("")]).optional(),
  descriptionText: z.string().trim().min(1, "Description is required."),
  requirementsText: z.union([z.string().trim(), z.literal("")]).optional(),
});

export type JobDescriptionFormInputValues = z.infer<typeof jobDescriptionFormInputSchema>;

export type JobDescriptionFormValues = {
  title: string;
  department?: string;
  location?: string;
  seniorityLevel?: SeniorityLevel;
  descriptionText: string;
  requirementsText?: string;
};

export function normalizeJobDescriptionFormValues(
  input: JobDescriptionFormInputValues,
): JobDescriptionFormValues {
  const normalized: JobDescriptionFormValues = {
    title: input.title.trim(),
    descriptionText: input.descriptionText.trim(),
  };

  if (input.department && input.department !== "") normalized.department = input.department;
  if (input.location && input.location !== "") normalized.location = input.location;
  if (input.seniorityLevel) normalized.seniorityLevel = input.seniorityLevel;
  if (input.requirementsText && input.requirementsText !== "")
    normalized.requirementsText = input.requirementsText;

  return normalized;
}

export const seniorityOptions: Array<{ label: string; value: SeniorityLevel }> = [
  { label: "Intern", value: "INTERN" },
  { label: "Junior", value: "JUNIOR" },
  { label: "Mid", value: "MID" },
  { label: "Senior", value: "SENIOR" },
  { label: "Staff", value: "STAFF" },
  { label: "Principal", value: "PRINCIPAL" },
];
