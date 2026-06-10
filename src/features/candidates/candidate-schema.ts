import { SeniorityLevel } from "@prisma/client";
import { z } from "zod";

export const candidateFormInputSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required."),
  email: z.string().trim().min(1, "Email is required.").email("Invalid email."),
  phone: z.string().trim().min(1, "Phone is required.").max(50),
  location: z.string().trim().min(1, "Location is required.").max(120),
  seniorityLevel: z.nativeEnum(SeniorityLevel, { message: "Seniority level is required." }),
  linkedInUrl: z.union([z.string().trim().url("Invalid URL."), z.literal("")]).optional(),
  githubUrl: z.union([z.string().trim().url("Invalid URL."), z.literal("")]).optional(),
});

export type CandidateFormInputValues = z.infer<typeof candidateFormInputSchema>;

export type CandidateFormValues = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  seniorityLevel: SeniorityLevel;
  linkedInUrl?: string;
  githubUrl?: string;
};

export function normalizeEmail(email?: string | null): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function normalizeCandidateFormValues(input: CandidateFormInputValues): CandidateFormValues {
  const normalized: CandidateFormValues = {
    fullName: input.fullName.trim(),
    email: normalizeEmail(input.email) ?? "",
    phone: input.phone.trim(),
    location: input.location.trim(),
    seniorityLevel: input.seniorityLevel,
  };

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
