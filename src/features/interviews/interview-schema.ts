import { InterviewStatus } from "@prisma/client";
import { z } from "zod";

export const interviewFormInputSchema = z
  .object({
    candidateId: z.string().trim().min(1, "Candidate is required."),
    jobDescriptionId: z.string().trim().min(1, "Job description is required."),
    assignedInterviewerId: z.union([z.string().trim(), z.literal("")]).optional(),
    status: z.nativeEnum(InterviewStatus),
    scheduledStartAt: z.union([z.string(), z.literal("")]).optional(),
    scheduledEndAt: z.union([z.string(), z.literal("")]).optional(),
    meetingUrl: z.union([z.string().trim().url("Invalid URL."), z.literal("")]).optional(),
    notesText: z.union([z.string(), z.literal("")]).optional(),
  })
  .superRefine((data, ctx) => {
    const startStr = data.scheduledStartAt && data.scheduledStartAt !== "" ? data.scheduledStartAt : undefined;
    const endStr = data.scheduledEndAt && data.scheduledEndAt !== "" ? data.scheduledEndAt : undefined;

    const start = startStr ? new Date(startStr) : undefined;
    const end = endStr ? new Date(endStr) : undefined;

    if (startStr && Number.isNaN(start?.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid scheduled start date/time.",
        path: ["scheduledStartAt"],
      });
    }
    if (endStr && Number.isNaN(end?.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid scheduled end date/time.",
        path: ["scheduledEndAt"],
      });
    }
    if (start && end && end.getTime() < start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scheduled end must not be before scheduled start.",
        path: ["scheduledEndAt"],
      });
    }
  });

export type InterviewFormInputValues = z.infer<typeof interviewFormInputSchema>;

export type InterviewFormValues = {
  candidateId: string;
  jobDescriptionId: string;
  assignedInterviewerId?: string | null;
  status: InterviewStatus;
  scheduledStartAt?: Date;
  scheduledEndAt?: Date;
  meetingUrl?: string;
  notesText?: string;
};

export function normalizeInterviewFormValues(input: InterviewFormInputValues): InterviewFormValues {
  const values: InterviewFormValues = {
    candidateId: input.candidateId.trim(),
    jobDescriptionId: input.jobDescriptionId.trim(),
    status: input.status,
  };

  if (typeof input.assignedInterviewerId === "string") {
    const trimmed = input.assignedInterviewerId.trim();
    values.assignedInterviewerId = trimmed.length > 0 ? trimmed : null;
  }
  if (input.scheduledStartAt && input.scheduledStartAt !== "") values.scheduledStartAt = new Date(input.scheduledStartAt);
  if (input.scheduledEndAt && input.scheduledEndAt !== "") values.scheduledEndAt = new Date(input.scheduledEndAt);
  if (input.meetingUrl && input.meetingUrl !== "") values.meetingUrl = input.meetingUrl;
  if (input.notesText && input.notesText !== "") values.notesText = input.notesText;

  return values;
}

export const statusOptions: Array<{ label: string; value: InterviewStatus }> = [
  { label: "Draft", value: "DRAFT" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];
