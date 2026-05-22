import type { AiProvider, AiProviderId, AiTextRequest, AiTextResponse } from "@/lib/ai/types";

type OpenAiProviderOptions = {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
};

export class OpenAiProvider implements AiProvider {
  public readonly id: AiProviderId = "openai";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(opts: OpenAiProviderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    this.timeoutMs = opts.timeoutMs ?? 25_000;
  }

  async generateText(req: AiTextRequest): Promise<AiTextResponse> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const messages: Array<{ role: "system" | "user"; content: string }> = [];
      if (req.system && req.system.trim() !== "") {
        messages.push({ role: "system", content: req.system.trim() });
      }
      messages.push({ role: "user", content: req.prompt });

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.3,
          messages,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`OpenAI error (${resp.status}): ${text || resp.statusText}`);
      }

      const json = (await resp.json()) as {
        id?: string;
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = json.choices?.[0]?.message?.content ?? "";
      return {
        text: content,
        provider: this.id,
        model: json.model ?? this.model,
        metadata: { requestId: json.id },
      };
    } finally {
      clearTimeout(t);
    }
  }
}
