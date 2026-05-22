import type { AiProvider, AiProviderId, AiTextRequest, AiTextResponse } from "@/lib/ai/types";

type GeminiProviderOptions = {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
};

export class GeminiProvider implements AiProvider {
  public readonly id: AiProviderId = "gemini";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(opts: GeminiProviderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
    this.timeoutMs = opts.timeoutMs ?? 25_000;
  }

  async generateText(req: AiTextRequest): Promise<AiTextResponse> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const system = req.system?.trim();
      const prompt = system ? `${system}\n\n${req.prompt}` : req.prompt;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.model,
      )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

      const resp = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Gemini error (${resp.status}): ${text || resp.statusText}`);
      }

      const json = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return { text, provider: this.id, model: this.model };
    } finally {
      clearTimeout(t);
    }
  }
}
