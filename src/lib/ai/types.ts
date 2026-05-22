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

