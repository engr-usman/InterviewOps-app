export type { AiProvider, AiProviderConfig, AiProviderId, AiTextRequest, AiTextResponse } from "@/lib/ai/types";

import type { AiProvider, AiProviderConfig, AiProviderId, AiTextRequest, AiTextResponse } from "@/lib/ai/types";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { OpenAiProvider } from "@/lib/ai/providers/openai";

export class MockAiProvider implements AiProvider {
  public readonly id: AiProviderId = "mock";

  async generateText(req: AiTextRequest): Promise<AiTextResponse> {
    const trimmed = req.prompt.trim();
    const text =
      trimmed.length === 0
        ? "Mock AI response."
        : trimmed.length <= 400
          ? `Mock AI summary: ${trimmed}`
          : `Mock AI summary: ${trimmed.slice(0, 400)}…`;

    return {
      text,
      provider: this.id,
      metadata: { mocked: true },
    };
  }
}

export function createAiProvider(config: AiProviderConfig): AiProvider {
  if (config.provider === "mock") return new MockAiProvider();

  if (config.provider === "openai") {
    if (!config.apiKey) return new MockAiProvider();
    return new OpenAiProvider({ apiKey: config.apiKey });
  }

  if (config.provider === "gemini") {
    if (!config.apiKey) return new MockAiProvider();
    return new GeminiProvider({ apiKey: config.apiKey });
  }

  return new MockAiProvider();
}
