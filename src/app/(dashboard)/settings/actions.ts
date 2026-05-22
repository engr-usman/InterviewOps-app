"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerAuthSession } from "@/auth";
import { upsertAppSetting, type AppSettingKey } from "@/server/services/app-settings";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const settingsSchema = z.object({
  aiEnabled: z.boolean(),
  aiProvider: z.enum(["mock", "openai", "gemini", "claude"]),
  openaiApiKey: z.union([z.string(), z.literal("")]).optional(),
  geminiApiKey: z.union([z.string(), z.literal("")]).optional(),
  aiGeneratedQuestionsEnabled: z.boolean(),
  aiEvaluationSuggestionsEnabled: z.boolean(),
  resumeParsingEnabled: z.boolean(),
  jdAnalysisEnabled: z.boolean(),
  maxResumeUploadMb: z.number().int().min(1).max(50),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

export async function updateSettingsAction(input: SettingsFormValues): Promise<ActionResult<{ ok: true }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid settings." };

  const maxBytes = parsed.data.maxResumeUploadMb * 1024 * 1024;

  const writes: Array<{ key: AppSettingKey; value: unknown }> = [
    { key: "ai.enabled", value: parsed.data.aiEnabled },
    { key: "ai.provider", value: parsed.data.aiProvider },
    { key: "ai.questions.enabled", value: parsed.data.aiGeneratedQuestionsEnabled },
    { key: "ai.evaluation.enabled", value: parsed.data.aiEvaluationSuggestionsEnabled },
    { key: "resumeParsing.enabled", value: parsed.data.resumeParsingEnabled },
    { key: "jdAnalysis.enabled", value: parsed.data.jdAnalysisEnabled },
    { key: "uploads.maxResumeBytes", value: maxBytes },
  ];

  await Promise.all(writes.map((w) => upsertAppSetting(w.key, w.value, session.user.id)));

  if (parsed.data.openaiApiKey && parsed.data.openaiApiKey !== "") {
    await upsertAppSetting("ai.openaiApiKey", parsed.data.openaiApiKey, session.user.id);
  }
  if (parsed.data.geminiApiKey && parsed.data.geminiApiKey !== "") {
    await upsertAppSetting("ai.geminiApiKey", parsed.data.geminiApiKey, session.user.id);
  }

  revalidatePath("/settings");
  return { ok: true, data: { ok: true } };
}
