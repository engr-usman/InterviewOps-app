export type AiProviderId = "mock" | "openai" | "gemini" | "claude";

export type AiProviderConfig = {
  provider: AiProviderId;
  apiKey?: string;
};

export type AiTextRequest = {
  system?: string;
  prompt: string;
};

export type AiTextResponse = {
  text: string;
  provider: AiProviderId;
  model?: string;
  metadata?: Record<string, unknown>;
};

export interface AiProvider {
  id: AiProviderId;
  generateText(req: AiTextRequest): Promise<AiTextResponse>;
}

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
  return new MockAiProvider();
}

