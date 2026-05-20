import { SeniorityLevel } from "@prisma/client";
import { z } from "zod";

export const candidateFormInputSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required."),
  email: z.union([z.string().trim().email("Invalid email."), z.literal("")]).optional(),
  phone: z.union([z.string().trim().max(50), z.literal("")]).optional(),
  location: z.union([z.string().trim().max(120), z.literal("")]).optional(),
  seniorityLevel: z.union([z.nativeEnum(SeniorityLevel), z.literal("")]).optional(),
  linkedInUrl: z.union([z.string().trim().url("Invalid URL."), z.literal("")]).optional(),
  githubUrl: z.union([z.string().trim().url("Invalid URL."), z.literal("")]).optional(),
});

export type CandidateFormInputValues = z.infer<typeof candidateFormInputSchema>;

export type CandidateFormValues = {
  fullName: string;
  email?: string;
  phone?: string;
  location?: string;
  seniorityLevel?: SeniorityLevel;
  linkedInUrl?: string;
  githubUrl?: string;
};

export function normalizeCandidateFormValues(input: CandidateFormInputValues): CandidateFormValues {
  const normalized: CandidateFormValues = {
    fullName: input.fullName.trim(),
  };

  if (input.email && input.email !== "") normalized.email = input.email;
  if (input.phone && input.phone !== "") normalized.phone = input.phone;
  if (input.location && input.location !== "") normalized.location = input.location;
  if (input.seniorityLevel) normalized.seniorityLevel = input.seniorityLevel;
  if (input.linkedInUrl && input.linkedInUrl !== "") normalized.linkedInUrl = input.linkedInUrl;
  if (input.githubUrl && input.githubUrl !== "") normalized.githubUrl = input.githubUrl;

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
