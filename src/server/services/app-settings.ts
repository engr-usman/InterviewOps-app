import { prisma } from "@/lib/prisma";

export type AppSettingKey =
  | "ai.enabled"
  | "ai.provider"
  | "ai.apiKey"
  | "ai.openaiApiKey"
  | "ai.geminiApiKey"
  | "ai.questions.enabled"
  | "ai.evaluation.enabled"
  | "resumeParsing.enabled"
  | "resumeParsing.aiResumeParser.enabled"
  | "resumeParsing.fallbackParser.enabled"
  | "jdAnalysis.enabled"
  | "uploads.maxResumeBytes";

type SettingValue = string | number | boolean | null;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function getAppSettingValue(key: AppSettingKey): Promise<SettingValue> {
  const row = await prisma.appSetting.findUnique({
    where: { key },
    select: { settingValue: true },
  });
  if (!row) return null;

  const value = row.settingValue as unknown;
  const record = asRecord(value);
  if (record && "value" in record) return record.value as SettingValue;
  return value as SettingValue;
}

export async function getBooleanSetting(key: AppSettingKey, fallback: boolean): Promise<boolean> {
  const value = await getAppSettingValue(key);
  return typeof value === "boolean" ? value : fallback;
}

export async function getNumberSetting(key: AppSettingKey, fallback: number): Promise<number> {
  const value = await getAppSettingValue(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function getStringSetting(key: AppSettingKey, fallback: string): Promise<string> {
  const value = await getAppSettingValue(key);
  return typeof value === "string" ? value : fallback;
}

export async function upsertAppSetting(key: AppSettingKey, settingValue: unknown, updatedById?: string | null) {
  return prisma.appSetting.upsert({
    where: { key },
    update: {
      settingValue: settingValue as never,
      updatedById: updatedById ?? null,
    },
    create: {
      key,
      settingValue: settingValue as never,
      updatedById: updatedById ?? null,
      isSystem: false,
    },
    select: { key: true },
  });
}
