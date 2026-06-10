import { InterviewStatus } from "@prisma/client";
import { z } from "zod";

export const interviewFormInputSchema = z
  .object({
    candidateId: z.string().trim().min(1, "Candidate is required."),
    jobDescriptionId: z.string().trim().min(1, "Job description is required."),
    assignedInterviewerId: z.string().trim().min(1, "Assigned interviewer is required."),
    status: z.nativeEnum(InterviewStatus),
    scheduledStartAt: z.string().trim().min(1, "Scheduled start is required."),
    scheduledEndAt: z.string().trim().min(1, "Scheduled end is required."),
    meetingUrl: z.string().trim().min(1, "Meeting URL is required.").url("Invalid URL."),
    notesText: z.union([z.string(), z.literal("")]).optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.scheduledStartAt);
    const end = new Date(data.scheduledEndAt);

    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid scheduled start date/time.",
        path: ["scheduledStartAt"],
      });
    }
    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid scheduled end date/time.",
        path: ["scheduledEndAt"],
      });
    }
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() < start.getTime()) {
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
  assignedInterviewerId: string;
  status: InterviewStatus;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  meetingUrl: string;
  notesText?: string;
};

export function normalizeInterviewFormValues(input: InterviewFormInputValues): InterviewFormValues {
  const values: InterviewFormValues = {
    candidateId: input.candidateId.trim(),
    jobDescriptionId: input.jobDescriptionId.trim(),
    assignedInterviewerId: input.assignedInterviewerId.trim(),
    status: input.status,
    scheduledStartAt: new Date(input.scheduledStartAt),
    scheduledEndAt: new Date(input.scheduledEndAt),
    meetingUrl: input.meetingUrl.trim(),
  };

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
