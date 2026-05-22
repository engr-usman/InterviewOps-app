import { createAiProvider, type AiProvider, type AiProviderId } from "@/lib/ai/provider";
import { getBooleanSetting, getStringSetting } from "@/server/services/app-settings";

export type AiRuntimeConfig = {
  enabled: boolean;
  provider: AiProviderId;
  openaiApiKey?: string;
  geminiApiKey?: string;
};

export async function getAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  const enabledFromEnv = process.env.AI_FEATURES_ENABLED === "true";
  const enabled = await getBooleanSetting("ai.enabled", enabledFromEnv);

  const providerFromEnv = (process.env.AI_PROVIDER ?? "").toLowerCase();
  const providerSetting = await getStringSetting("ai.provider", providerFromEnv || "mock");
  const provider =
    providerSetting === "openai" || providerSetting === "gemini" || providerSetting === "claude"
      ? (providerSetting as AiProviderId)
      : "mock";

  const openaiApiKey = process.env.OPENAI_API_KEY || (await getStringSetting("ai.openaiApiKey", ""));
  const geminiApiKey = process.env.GEMINI_API_KEY || (await getStringSetting("ai.geminiApiKey", ""));

  return { enabled, provider, openaiApiKey: openaiApiKey || undefined, geminiApiKey: geminiApiKey || undefined };
}

export async function getAiProviderOrThrow(): Promise<AiProvider> {
  const cfg = await getAiRuntimeConfig();
  if (!cfg.enabled) throw new Error("AI features are disabled.");

  if (cfg.provider === "openai") {
    if (!cfg.openaiApiKey) throw new Error("OpenAI API key is missing.");
    return createAiProvider({ provider: "openai", apiKey: cfg.openaiApiKey });
  }

  if (cfg.provider === "gemini") {
    if (!cfg.geminiApiKey) throw new Error("Gemini API key is missing.");
    return createAiProvider({ provider: "gemini", apiKey: cfg.geminiApiKey });
  }

  return createAiProvider({ provider: "mock" });
}

