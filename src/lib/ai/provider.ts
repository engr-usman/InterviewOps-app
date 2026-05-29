export type { AiProvider, AiProviderConfig, AiProviderId, AiTextRequest, AiTextResponse } from "@/lib/ai/types";

import type { AiProvider, AiProviderConfig, AiProviderId, AiTextRequest, AiTextResponse } from "@/lib/ai/types";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { OpenAiProvider } from "@/lib/ai/providers/openai";

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function extractSkillHints(text: string): string[] {
  const dictionary = [
    "AWS",
    "Azure",
    "GCP",
    "Kubernetes",
    "Docker",
    "Terraform",
    "Pulumi",
    "CI/CD",
    "GitHub Actions",
    "Jenkins",
    "PostgreSQL",
    "Redis",
    "Kafka",
    "Python",
    "TypeScript",
    "Go",
    "Java",
    "Linux",
  ];
  const lower = text.toLowerCase();
  const out: string[] = [];
  for (const s of dictionary) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(s.length <= 3 ? `\\b${escaped}\\b` : escaped, "i");
    if (re.test(lower)) out.push(s);
  }
  return Array.from(new Set(out)).slice(0, 6);
}

function summarizePlainText(input: string): string {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (cleaned.length < 80) return "Not enough readable text to summarize.";
  const hints = extractSkillHints(cleaned);
  const hintText = hints.length > 0 ? ` Key topics include ${hints.join(", ")}.` : "";
  return `The text indicates relevant professional experience and project work. It highlights hands-on delivery and problem-solving across typical engineering responsibilities.${hintText}`;
}

function jsonResponse(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

export class MockAiProvider implements AiProvider {
  public readonly id: AiProviderId = "mock";

  async generateText(req: AiTextRequest): Promise<AiTextResponse> {
    const prompt = req.prompt.trim();
    const system = (req.system ?? "").toLowerCase();

    let text: string;
    const wantsJson =
      system.includes("return valid json") || (prompt.startsWith("{") && prompt.endsWith("}") && prompt.includes(`"task"`));

    if (wantsJson) {
      const parsed = safeJsonParse(prompt);
      const task =
        typeof parsed === "object" && parsed !== null && "task" in parsed && typeof (parsed as { task?: unknown }).task === "string"
          ? ((parsed as { task: string }).task as string)
          : "";

      if (task.includes("Analyze a candidate profile")) {
        const candidateName =
          typeof parsed === "object" && parsed !== null
            ? (parsed as { candidate?: { name?: unknown } }).candidate?.name
            : null;
        const name = typeof candidateName === "string" ? candidateName : "The candidate";
        text = jsonResponse({
          profileSummary: `${name} shows relevant experience and practical delivery on cloud/infrastructure work.`,
          strengths: ["Clear operational mindset", "Hands-on delivery", "Uses structured troubleshooting"],
          weaknesses: ["Some details are high-level", "Limited quantified impact in examples"],
          likelySeniorityAssessment: "Mid-level to senior.",
          interviewRiskAreas: ["Depth on incident response", "Trade-offs in architecture decisions"],
          suggestedFocusTopics: ["Kubernetes operations", "Terraform patterns", "Observability and SLOs", "Security basics"],
        });
      } else if (task.includes("Analyze a job description")) {
        text = jsonResponse({
          summary: "Role focuses on operating cloud infrastructure, reliability, and delivery automation.",
          keyTechnicalRequirements: ["Operate production Kubernetes", "Infrastructure as Code", "Observability and incident response"],
          criticalSkills: ["AWS", "Kubernetes", "Terraform", "Linux"],
          expectedCompetencyAreas: ["Reliability engineering", "Automation", "System design trade-offs"],
          suggestedInterviewDomains: ["Kubernetes", "IaC", "Networking", "Observability", "Security"],
        });
      } else if (task.includes("Generate interview questions")) {
        const count =
          typeof parsed === "object" && parsed !== null
            ? (parsed as { inputs?: { count?: unknown } }).inputs?.count
            : null;
        const n = typeof count === "number" && Number.isFinite(count) ? Math.max(1, Math.min(10, Math.floor(count))) : 5;
        text = jsonResponse({
          questions: Array.from({ length: n }).map((_, idx) => ({
            topic: "Systems",
            difficulty: "medium",
            questionText: `Walk through how you would diagnose a production latency spike affecting multiple services (Q${idx + 1}).`,
            tags: ["troubleshooting", "observability", "systems"],
          })),
        });
      } else if (task.includes("follow-up questions")) {
        text = jsonResponse({
          followUps: [
            {
              questionText: "What signals would you look at first and why?",
              intent: "Assess prioritization and observability instincts.",
              tags: ["observability", "prioritization"],
            },
            {
              questionText: "How would you validate your hypothesis safely in production?",
              intent: "Probe safety and change management.",
              tags: ["safety", "debugging"],
            },
            {
              questionText: "What would you do if metrics contradict logs?",
              intent: "Probe depth in troubleshooting methodology.",
              tags: ["debugging", "signals"],
            },
          ],
        });
      } else if (task.includes("evaluation assistance")) {
        text = jsonResponse({
          suggestedScore: 7,
          technicalDepthAssessment: "Shows solid fundamentals; probe deeper on trade-offs.",
          missingConcepts: ["Clear SLOs/SLIs definition", "Blast radius mitigation"],
          redFlags: ["Overconfident answers without verification steps"],
          strongSignals: ["Structured debugging", "Clear rollback strategy"],
          confidenceAssessment: "Medium confidence based on limited context.",
        });
      } else if (task.includes("interview summary")) {
        text = jsonResponse({
          interviewSummary: "Candidate communicated clearly and demonstrated practical troubleshooting.",
          strengthsSummary: ["Structured thinking", "Good operational instincts"],
          weaknessesSummary: ["Needs deeper detail on architecture trade-offs"],
          hiringRecommendationReasoning: "Recommend moving forward if role matches hands-on ops needs.",
          finalVerdictExplanation: "Positive signal overall; validate depth in next round.",
          suggestedRecommendation: null,
        });
      } else {
        text = jsonResponse({ ok: true, message: "JSON response (unrecognized task)." });
      }
    } else if (/summarize this resume/i.test(prompt)) {
      const parts = prompt.split(/\n\n/);
      const resumeText = parts.length > 1 ? parts.slice(1).join("\n\n") : "";
      text = summarizePlainText(resumeText);
    } else if (/summarize this job description/i.test(prompt)) {
      const parts = prompt.split(/\n\n/);
      const jdText = parts.length > 1 ? parts.slice(1).join("\n\n") : "";
      text = summarizePlainText(jdText);
    } else {
      text = "AI response generated.";
    }

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
