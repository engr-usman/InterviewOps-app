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

function matchesGoStrict(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\bgolang\b/i.test(lower)) return true;
  if (/\bgo\s+language\b/i.test(lower)) return true;
  if (/\bgo\s+programming\b/i.test(lower)) return true;
  return false;
}

function matchList(text: string, dictionary: string[]): string[] {
  const out: string[] = [];
  for (const item of dictionary) {
    if (item === "Go") {
      if (matchesGoStrict(text)) out.push("Go");
      continue;
    }
    const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(item.length <= 3 ? `\\b${escaped}\\b` : `(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i");
    if (re.test(text)) out.push(item);
  }
  return Array.from(new Set(out));
}

function parseYearsText(text: string): string | null {
  const m =
    text.match(/\b(\d{1,2})\s*([+＋])\s*(years?|yrs?)\b/i) ??
    text.match(/\b(over|more\s+than)\s+(\d{1,2})\s+(years?|yrs?)\b/i) ??
    text.match(/\b(\d{1,2})\s+(years?|yrs?)\s+.*?\bexperience\b/i);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 60) return null;
  const isPlus = Boolean(m[1]?.toLowerCase().includes("over") || m[1]?.toLowerCase().includes("more") || m[2] === "+" || m[2] === "＋");
  return `${n}${isPlus ? "+" : ""} years`;
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
      } else if (task.includes("Parse a resume into structured resume analysis")) {
        const resumeText =
          typeof parsed === "object" && parsed !== null ? ((parsed as { resumeText?: unknown }).resumeText as unknown) : null;
        const raw = typeof resumeText === "string" ? resumeText : "";

        const years = parseYearsText(raw);

        const cloudPlatforms = matchList(raw, ["AWS", "Azure", "GCP", "Google Cloud"]);
        const awsServices = matchList(raw, ["AWS Lambda", "Lambda", "API Gateway", "DynamoDB", "EventBridge", "S3", "IAM", "CloudWatch", "SQS", "SNS"]);
        const containersOrchestration = matchList(raw, ["Kubernetes", "Docker", "Helm"]);
        const infrastructureAsCode = matchList(raw, ["Terraform", "CloudFormation", "Pulumi", "Ansible"]);
        const cicd = matchList(raw, ["CI/CD", "GitHub Actions", "Jenkins", "CircleCI"]);
        const monitoringLogging = matchList(raw, ["Prometheus", "Grafana", "ELK", "Elastic Stack", "Kibana", "Elasticsearch"]);
        const securityDevSecOps = matchList(raw, ["DevSecOps", "Security Hardening", "Security"]);
        const databases = matchList(raw, ["PostgreSQL", "MySQL", "Redis", "MongoDB", "DynamoDB"]);
        const programmingScripting = matchList(raw, ["Python", "Node.js", "TypeScript", "Java", "Go"]);
        const sreReliability = matchList(raw, [
          "SRE",
          "Reliability Engineering",
          "Incident Response",
          "SLO",
          "SLI",
          "Error Budgets",
          "Disaster Recovery",
          "High Availability",
          "Cost Optimization",
        ]);
        const leadershipArchitecture = matchList(raw, [
          "Cloud Architecture",
          "Architecture",
          "Leadership",
          "Mentoring",
          "AWS Well-Architected",
          "Serverless",
          "Multi-account strategy",
        ]);

        const certifications = matchList(raw, [
          "Certified Kubernetes Administrator (CKA)",
          "AWS Certified Cloud Practitioner",
          "AWS Certified Developer – Associate",
          "AWS Certified Solutions Architect – Associate",
          "AWS Certified Solutions Architect – Professional",
          "AWS Technical Professional",
          "AWS Community Builder",
          "Google Professional Cloud Architect",
        ]);

        const trainingsCommunity = matchList(raw, ["AWS Community Builder", "Linux Foundation", "Google Developer Groups", "GDG"]);
        const leadershipIndicators = matchList(raw, [
          "Team leadership",
          "Mentoring",
          "Architecture design",
          "AWS Well-Architected",
          "Cost optimization",
          "Disaster recovery",
          "High availability",
          "Incident response",
          "DevSecOps",
          "Multi-account strategy",
          "Cloud transformation",
          "Training delivery",
          "Community speaking",
        ]);

        const skills = Array.from(
          new Set(
            [
              ...cloudPlatforms,
              ...awsServices,
              ...containersOrchestration,
              ...infrastructureAsCode,
              ...cicd,
              ...monitoringLogging,
              ...securityDevSecOps,
              ...databases,
              ...programmingScripting,
              ...sreReliability,
              ...leadershipArchitecture,
            ]
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ).slice(0, 80);

        const extractionStatus = raw.trim().length > 120 ? "success" : raw.trim().length > 0 ? "partial" : "failed";
        const summaryBase =
          skills.length > 0
            ? `Resume indicates experience across ${skills.slice(0, 8).join(", ")}.`
            : "Resume text extracted, but no technical skills detected yet.";
        const summary = years ? `${summaryBase} Reported experience: ${years}.` : summaryBase;

        text = jsonResponse({
          summary,
          candidateTitle: null,
          yearsOfExperience: years,
          seniorityAssessment: null,
          skills,
          skillCategories: {
            cloudPlatforms,
            awsServices,
            azureServices: [],
            gcpServices: [],
            containersOrchestration,
            infrastructureAsCode,
            cicd,
            monitoringLogging,
            securityDevSecOps,
            databases,
            programmingScripting,
            sreReliability,
            leadershipArchitecture,
          },
          certifications,
          trainingsCommunity,
          leadershipIndicators,
          workExperience: [],
          education: [],
          strengths: leadershipIndicators.slice(0, 6),
          possibleConcerns: [],
          suggestedInterviewFocusAreas: sreReliability.slice(0, 6),
          extractionStatus,
          extractionMethod: "ai",
          parserWarnings: [],
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
