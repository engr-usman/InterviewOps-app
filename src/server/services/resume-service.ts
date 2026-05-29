import { SourceType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { createAiProvider } from "@/lib/ai/provider";
import { getBooleanSetting, getStringSetting } from "@/server/services/app-settings";
import { slugifySkillName, uniqueStrings, upsertSkillsByName } from "@/server/services/skill-utils";

type Db = {
  candidate: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
};

type TxDb = {
  candidate: { updateMany: (args: unknown) => Promise<unknown> };
};

export async function getCandidateResumeSkillMatches(input: {
  candidateId: string;
  organizationId: string;
  take?: number;
}): Promise<Array<{ confidence: number | null; skill: { name: string } }>> {
  const rows = await prisma.candidateSkillMatch.findMany({
    where: { candidateId: input.candidateId, sourceType: SourceType.RESUME, candidate: { organizationId: input.organizationId } },
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    take: input.take ?? 50,
    select: { confidence: true, skill: { select: { name: true } } },
  });
  return rows.map((r) => ({ confidence: r.confidence ?? null, skill: { name: r.skill.name } }));
}

export type ParsedResumeJson = {
  parsedAt: string;
  candidateId?: string;
  resumeFileName?: string | null;
  resumeFileSize?: number;
  resumeMimeType?: string | null;
  summary?: string;
  yearsOfExperience?: number;
  yearsOfExperienceText?: string;
  skills: string[];
  cloudPlatforms: string[];
  tools: string[];
  certifications: string[];
  trainings: string[];
  skillCategories: {
    cloudPlatforms: string[];
    awsServices: string[];
    containersOrchestration: string[];
    infrastructureAsCode: string[];
    cicd: string[];
    monitoringLogging: string[];
    securityDevsecops: string[];
    databases: string[];
    programmingScripting: string[];
    leadershipArchitecture: string[];
    sreReliability: string[];
  };
  leadershipIndicators: string[];
  companies: string[];
  education: string[];
  projects: string[];
  rawTextPreview: string;
  extractedTextPreview: string;
  extractionStatus: "success" | "failed";
  extractionError?: string;
  extractionMethod?: string;
  parser: {
    provider: string;
    extractedAt: string;
    version: string;
  };
  extraction: {
    ok: boolean;
    status: "ok" | "unsupported" | "failed";
    message: string | null;
    fileType: "pdf" | "doc" | "docx" | "unknown" | null;
    mimeType: string | null;
  };
};

function extractTextFallback(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  const stripped = utf8.replace(/\0/g, " ").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
  return stripped.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeExtractedText(input: string): string {
  const stripped = input.replace(/\0/g, " ").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
  return stripped.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function looksLikePdfInternals(text: string): boolean {
  const head = text.slice(0, 4000);
  if (/^\s*%PDF-\d/i.test(head)) return true;
  if (/\/Type\s*\/Catalog\b/i.test(head)) return true;
  const objCount = (head.match(/\b\d+\s+\d+\s+obj\b/gi) ?? []).length;
  const endObjCount = (head.match(/\bendobj\b/gi) ?? []).length;
  if (objCount >= 2 && endObjCount >= 2) return true;
  if (/\bxref\b/i.test(head) && /\btrailer\b/i.test(head)) return true;
  return false;
}

function isMostlyReadable(text: string): boolean {
  const sample = text.slice(0, 6000);
  const total = sample.length;
  if (total < 60) return false;
  const letters = (sample.match(/[A-Za-z]/g) ?? []).length;
  const whitespace = (sample.match(/\s/g) ?? []).length;
  const ratio = (letters + whitespace) / total;
  if (letters < 25) return false;
  return ratio >= 0.55;
}

function truncateForLog(input: string, max = 220): string {
  const clean = input.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

function detectFileType(buffer: Buffer): "pdf" | "doc" | "docx" | "unknown" {
  const head4 = buffer.subarray(0, 4).toString("ascii");
  if (head4.startsWith("%PDF")) return "pdf";
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) return "docx";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return "doc";
  }
  return "unknown";
}

type PdfExtractAttempt = {
  ok: boolean;
  text: string;
  error?: string;
  rawLength?: number;
  sanitizedLength?: number;
  method: "pdf-parse" | "pdfjs-dist" | "pdf2json";
};

async function extractPdfTextWithPdfParse(buffer: Buffer): Promise<PdfExtractAttempt> {
  const debug = process.env.RESUME_PARSING_DEBUG === "1" || process.env.NODE_ENV !== "production";
  try {
    const mod = (await import("pdf-parse")) as unknown as { default?: unknown };
    const pdfParse = (mod.default ?? mod) as (data: Buffer) => Promise<{ text?: unknown }>;
    const result = await pdfParse(buffer);
    const text = typeof result?.text === "string" ? result.text : null;
    const rawLength = text?.length ?? 0;
    const safe = text ? sanitizeExtractedText(text) : "";
    const sanitizedLength = safe.length;
    return { ok: safe.length > 0, text: safe, rawLength, sanitizedLength, method: "pdf-parse" };
  } catch (e) {
    if (debug) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[resume-service] pdf-parse extraction failed: ${msg}`);
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, text: "", error: msg, method: "pdf-parse" };
  }
}

async function extractPdfTextWithPdfjs(buffer: Buffer): Promise<PdfExtractAttempt> {
  const debug = process.env.RESUME_PARSING_DEBUG === "1" || process.env.NODE_ENV !== "production";
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdfjsLib = pdfjs as unknown as {
      getDocument: (args: unknown) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<unknown>; destroy: () => Promise<void> }> };
      GlobalWorkerOptions?: { workerSrc?: string; workerPort?: unknown };
    };

    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
      pdfjsLib.GlobalWorkerOptions.workerPort = null;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;
    let text = "";
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = (await doc.getPage(pageNum)) as { getTextContent: () => Promise<{ items: unknown[] }> };
      const content = await page.getTextContent();
      const items = content.items as Array<{ str?: unknown }>;
      const pageText = items.map((i) => (typeof i.str === "string" ? i.str : "")).filter(Boolean).join(" ");
      if (pageText) text += `${pageText}\n`;
    }
    await doc.destroy();
    const rawLength = text.length;
    const safe = sanitizeExtractedText(text);
    const sanitizedLength = safe.length;
    return { ok: safe.length > 0, text: safe, rawLength, sanitizedLength, method: "pdfjs-dist" };
  } catch (e) {
    if (debug) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[resume-service] pdfjs extraction failed: ${msg}`);
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, text: "", error: msg, method: "pdfjs-dist" };
  }
}

async function extractPdfTextWithPdf2json(buffer: Buffer): Promise<PdfExtractAttempt> {
  const debug = process.env.RESUME_PARSING_DEBUG === "1" || process.env.NODE_ENV !== "production";
  try {
    const mod = await import("pdf2json");
    const PDFParser = (mod as unknown as {
      default: new () => { on: (e: string, cb: (...args: unknown[]) => void) => void; parseBuffer: (b: Buffer) => void };
    }).default;

    const parser = new PDFParser();
    const data = await new Promise<unknown>((resolve, reject) => {
      parser.on("pdfParser_dataError", (err: unknown) => reject(err));
      parser.on("pdfParser_dataReady", (pdfData: unknown) => resolve(pdfData));
      parser.parseBuffer(buffer);
    });

    const root = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
    const pagesValue = root ? root["Pages"] : null;
    const pages = Array.isArray(pagesValue) ? pagesValue : null;
    if (!pages) return { ok: false, text: "", error: "pdf2json returned no pages.", method: "pdf2json" };

    let text = "";
    for (const page of pages) {
      const pageRec = typeof page === "object" && page !== null ? (page as Record<string, unknown>) : null;
      const textsValue = pageRec ? pageRec["Texts"] : null;
      const texts = Array.isArray(textsValue) ? textsValue : null;
      if (!texts) continue;
      for (const t of texts) {
        const tRec = typeof t === "object" && t !== null ? (t as Record<string, unknown>) : null;
        const runsValue = tRec ? tRec["R"] : null;
        const runs = Array.isArray(runsValue) ? runsValue : null;
        if (!runs) continue;
        for (const r of runs) {
          const rRec = typeof r === "object" && r !== null ? (r as Record<string, unknown>) : null;
          const encoded = rRec ? rRec["T"] : null;
          if (typeof encoded !== "string") continue;
          let decoded = "";
          try {
            decoded = decodeURIComponent(encoded);
          } catch {
            decoded = encoded;
          }
          if (decoded) text += `${decoded} `;
        }
      }
      text += "\n";
    }

    const rawLength = text.length;
    const safe = sanitizeExtractedText(text);
    const sanitizedLength = safe.length;
    return { ok: safe.length > 0, text: safe, rawLength, sanitizedLength, method: "pdf2json" };
  } catch (e) {
    if (debug) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[resume-service] pdf2json extraction failed: ${msg}`);
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, text: "", error: msg, method: "pdf2json" };
  }
}

export async function extractResumeTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<{ ok: boolean; text: string; error?: string; method?: string }> {
  const debug = process.env.RESUME_PARSING_DEBUG === "1" || process.env.NODE_ENV !== "production";
  const normalizedMime = mimeType.toLowerCase();
  const fileType = detectFileType(buffer);
  if (fileType !== "pdf") {
    return {
      ok: false,
      text: "",
      error: `Only PDF extraction is supported right now (mime=${normalizedMime}).`,
      method: "unsupported",
    };
  }

  const attempts: PdfExtractAttempt[] = [
    await extractPdfTextWithPdfParse(buffer),
    await extractPdfTextWithPdfjs(buffer),
    await extractPdfTextWithPdf2json(buffer),
  ];
  for (const attempt of attempts) {
    const safeText = attempt.text;
    const ok =
      safeText.length > 50 && !looksLikePdfInternals(safeText) && isMostlyReadable(safeText);
    if (debug) {
      console.info(
        `[resume-service] pdf extract attempt method=${attempt.method} rawLen=${attempt.rawLength ?? 0} sanitizedLen=${
          attempt.sanitizedLength ?? attempt.text.length
        } ok=${ok} err=${attempt.error ? attempt.error : ""}`,
      );
    }
    if (ok) return { ok: true, text: safeText, method: attempt.method };
  }

  const errors = attempts.map((a) => `${a.method}: ${a.error ?? "no-text"}`).join(" | ");
  return { ok: false, text: "", error: `PDF text extraction failed. ${errors}`, method: attempts[0]?.method ?? "pdf-parse" };
}

async function extractResumeText(input: {
  buffer: Buffer;
  mimeType: string | null;
}): Promise<{ text: string; extraction: ParsedResumeJson["extraction"]; extractionMethod?: string; extractionError?: string }> {
  const fileType = detectFileType(input.buffer);

  if (fileType === "pdf") {
    const extracted = await extractResumeTextFromBuffer(input.buffer, input.mimeType ?? "application/pdf");
    const safeText = extracted.ok ? extracted.text : "";
    if (!safeText || looksLikePdfInternals(safeText) || !isMostlyReadable(safeText)) {
      return {
        text: "",
        extractionMethod: extracted.method,
        extractionError: extracted.error,
        extraction: {
          ok: false,
          status: "failed",
          message: "Resume uploaded successfully, but text extraction failed.",
          fileType,
          mimeType: input.mimeType,
        },
      };
    }
    return {
      text: safeText,
      extractionMethod: extracted.method,
      extractionError: extracted.ok ? undefined : extracted.error,
      extraction: { ok: true, status: "ok", message: null, fileType, mimeType: input.mimeType },
    };
  }

  if (fileType === "doc" || fileType === "docx") {
    return {
      text: "",
      extractionMethod: "unsupported",
      extractionError: "DOC/DOCX extraction is not available.",
      extraction: {
        ok: false,
        status: "unsupported",
        message: "Resume uploaded successfully, but text extraction is not available yet.",
        fileType,
        mimeType: input.mimeType,
      },
    };
  }

  const fallback = sanitizeExtractedText(extractTextFallback(input.buffer));
  if (!fallback || looksLikePdfInternals(fallback) || !isMostlyReadable(fallback)) {
    return {
      text: "",
      extractionMethod: "fallback",
      extractionError: "Readable text could not be extracted.",
      extraction: {
        ok: false,
        status: "failed",
        message: "Resume uploaded successfully, but text extraction failed.",
        fileType,
        mimeType: input.mimeType,
      },
    };
  }

  return {
    text: fallback,
    extractionMethod: "fallback",
    extraction: { ok: true, status: "ok", message: null, fileType, mimeType: input.mimeType },
  };
}

function extractYearsOfExperienceInfo(text: string): { years?: number; text?: string } {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();

  const explicit =
    lower.match(/\b(over|more\s+than)\s+(\d{1,2})\s+(years?|yrs?)\b/i) ??
    lower.match(/\b(\d{1,2})\s*([+＋])\s*(years?|yrs?)\b/i) ??
    lower.match(/\b(\d{1,2})\s+(years?|yrs?)\b/i);

  if (explicit) {
    const num = Number(explicit[2] ?? explicit[1]);
    if (Number.isFinite(num) && num > 0 && num <= 60) {
      const plus = Boolean(explicit[1]?.includes("over") || explicit[1]?.includes("more") || explicit[2] === "+" || explicit[2] === "＋");
      const withContext = new RegExp(`\\b${num}\\s*([+＋])?\\s*(years?|yrs?)\\s+.*?\\bexperience\\b`, "i").test(normalized);
      const textValue = plus || withContext ? `${num}+` : `${num}`;
      return { years: num, text: textValue };
    }
  }

  const fromHistory = estimateYearsFromDateRanges(normalized);
  if (typeof fromHistory === "number") return { years: fromHistory, text: `${fromHistory}+` };

  return {};
}

function estimateYearsFromDateRanges(text: string): number | undefined {
  const nowYear = new Date().getFullYear();
  const ranges: Array<{ startYear: number; endYear: number; endIsOpen: boolean }> = [];

  const yearRangeRe = /\b(19|20)\d{2}\b\s*[-–—]\s*(present|current|\b(19|20)\d{2}\b)/gi;
  for (const m of text.matchAll(yearRangeRe)) {
    const startYear = Number(m[0].slice(0, 4));
    const endToken = m[2];
    const endIsOpen = typeof endToken === "string" && /present|current/i.test(endToken);
    const endYear = endIsOpen ? nowYear : Number(endToken);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) continue;
    if (startYear < 1970 || startYear > nowYear) continue;
    if (endYear < startYear || endYear > nowYear + 1) continue;
    ranges.push({ startYear, endYear, endIsOpen });
  }

  const monthRangeRe =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+((19|20)\d{2})\b\s*[-–—]\s*(present|current|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+((19|20)\d{2})\b)/gi;
  for (const m of text.matchAll(monthRangeRe)) {
    const startYear = Number(m[2]);
    const endIsOpen = typeof m[4] === "string" && /present|current/i.test(m[4]);
    const endYear = endIsOpen ? nowYear : Number(m[7]);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) continue;
    if (startYear < 1970 || startYear > nowYear) continue;
    if (endYear < startYear || endYear > nowYear + 1) continue;
    ranges.push({ startYear, endYear, endIsOpen });
  }

  if (ranges.length === 0) return undefined;
  const minStart = Math.min(...ranges.map((r) => r.startYear));
  const maxEnd = Math.max(...ranges.map((r) => r.endYear));
  const years = Math.max(0, maxEnd - minStart);
  if (years < 1 || years > 60) return undefined;
  return years;
}

function extractCertifications(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];

  if (/\bcka\b/i.test(text) || /\bcertified\s+kubernetes\s+administrator\b/i.test(lower)) {
    out.push("Certified Kubernetes Administrator (CKA)");
  }
  if (/\bckad\b/i.test(text) || /\bcertified\s+kubernetes\s+application\s+developer\b/i.test(lower)) {
    out.push("Certified Kubernetes Application Developer (CKAD)");
  }

  if (/\baws\s+certified\s+cloud\s+practitioner\b/i.test(lower) || (/\bcloud\s+practitioner\b/i.test(lower) && /\baws\s+certified\b/i.test(lower))) {
    out.push("AWS Certified Cloud Practitioner");
  }

  if (
    /\baws\s+certified\s+developer\b/i.test(lower) &&
    (/\bassociate\b/i.test(lower) || /\bassociate\s+level\b/i.test(lower) || /\bdeveloper\s+associate\b/i.test(lower))
  ) {
    out.push("AWS Certified Developer – Associate");
  }

  const hasAwsCertified = /\baws\s+certified\b/i.test(lower);
  const hasAws = /\baws\b/i.test(lower);
  const hasSaa = /\bsolutions\s+architect\b/i.test(lower);
  const hasProfessional = /\bprofessional\b/i.test(lower);
  const hasAssociate = /\bassociate\b/i.test(lower);
  if ((hasAwsCertified || hasAws) && hasSaa && hasProfessional) {
    out.push("AWS Certified Solutions Architect – Professional");
  } else if ((hasAwsCertified || hasAws) && hasSaa && hasAssociate) {
    out.push("AWS Certified Solutions Architect – Associate");
  } else if (/\baws\s+technical\s+professional\b/i.test(lower)) {
    out.push("AWS Technical Professional");
  }

  if (/\bgoogle\b/i.test(lower) && /\bprofessional\s+cloud\s+architect\b/i.test(lower)) {
    out.push("Google Professional Cloud Architect");
  } else if (/\bprofessional\s+cloud\s+architect\b/i.test(lower)) {
    out.push("Google Professional Cloud Architect");
  }

  return uniqueStrings(out);
}

function extractTrainings(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];

  if (/\baws\s+community\s+builder\b/i.test(lower)) out.push("AWS Community Builder");
  if (/\bgdg\b/i.test(lower) || /\bgoogle\s+developer\s+groups\b/i.test(lower)) out.push("Google Developer Groups (GDG)");
  if (/\blinux\s+foundation\b/i.test(lower)) out.push("Linux Foundation training/community");
  if (/\bkubernetes\b/i.test(lower) && /\bfoundation\b/i.test(lower)) out.push("Kubernetes/Linux Foundation references");
  if (/\btrainer\b/i.test(lower) || /\btraining\b/i.test(lower) || /\bworkshop\b/i.test(lower)) out.push("Training delivery / workshops");
  if (/\bspeaker\b/i.test(lower) || /\btalks?\b/i.test(lower) || /\bconference\b/i.test(lower)) out.push("Community speaking");

  return uniqueStrings(out);
}

function detectLeadershipIndicators(text: string): string[] {
  const indicators: Array<{ label: string; re: RegExp }> = [
    { label: "Team leadership", re: /\b(led|leading|leadership|managed|manager|head\s+of|owned|ownership)\b/i },
    { label: "Mentoring", re: /\b(mentored|mentor|coached|training|trained|workshop)\b/i },
    { label: "Architecture design", re: /\b(architected|architecture|architect|designed|design|system\s+design|cloud\s+architecture|reference\s+architecture)\b/i },
    { label: "AWS Well-Architected", re: /\b(well-architected|well\s+architected)\b/i },
    { label: "Cost optimization", re: /\b(cost\s+optimization|finops|cost\s+saving|cost\s+reduction)\b/i },
    { label: "Disaster recovery", re: /\b(disaster\s+recovery|dr\s+strategy|backup\s+and\s+recovery)\b/i },
    { label: "High availability", re: /\b(high\s+availability|ha\s+design|fault\s+tolerant|multi-az|multi-region)\b/i },
    { label: "Multi-account strategy", re: /\b(multi-account|multi\s+account|landing\s+zone|organizations)\b/i },
    { label: "Cloud transformation", re: /\b(cloud\s+transformation|migration|modernization)\b/i },
    { label: "Training delivery", re: /\b(training\s+delivery|trainer|instructor|facilitated)\b/i },
    { label: "Community speaking", re: /\b(speaker|talks?|conference|meetup|gdg)\b/i },
    { label: "Incident leadership", re: /\b(incident\s+response|on-?call|postmortem|root\s+cause|rca)\b/i },
    { label: "DevSecOps", re: /\b(devsecops|security\s+hardening|threat|vulnerability|iam)\b/i },
  ];
  return uniqueStrings(indicators.filter((i) => i.re.test(text)).map((i) => i.label)).slice(0, 12);
}

function inferPrimaryTitle(text: string): string {
  const lower = text.toLowerCase();
  const isTechnical = /\b(aws|azure|gcp|kubernetes|docker|terraform|ci\/cd|devops|sre)\b/i.test(text);
  if (!isTechnical) return "Candidate";
  if (/\bprincipal\b/.test(lower)) return "Principal DevOps Engineer";
  if (/\bstaff\b/.test(lower)) return "Staff DevOps Engineer";
  if (/\bsite\s+reliability\s+engineer\b/.test(lower) || /\bsre\b/.test(lower)) return "Site Reliability Engineer";
  if (/\bplatform\s+engineer\b/.test(lower)) return "Platform Engineer";
  if (/\bdevops\s+engineer\b/.test(lower)) return "DevOps Engineer";
  return "DevOps Engineer";
}

function formatYearsText(value?: string): string | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  return `${t} years of experience`;
}

function buildSkillCategories(text: string): ParsedResumeJson["skillCategories"] {
  const cloudPlatforms = pickListMatches(text, ["AWS", "Azure", "GCP", "Google Cloud", "Google Cloud Platform"]);
  const awsServices = pickListMatches(text, [
    "EC2",
    "EKS",
    "ECS",
    "S3",
    "IAM",
    "VPC",
    "Route 53",
    "RDS",
    "CloudWatch",
    "CloudTrail",
    "Lambda",
    "AWS Lambda",
    "API Gateway",
    "DynamoDB",
    "EventBridge",
    "SQS",
    "SNS",
  ]);
  const containersOrchestration = pickListMatches(text, ["Docker", "Kubernetes", "Helm"]);
  const infrastructureAsCode = pickListMatches(text, ["Terraform", "Pulumi", "Ansible", "CloudFormation"]);
  const cicd = pickListMatches(text, ["CI/CD", "GitHub Actions", "Jenkins", "CircleCI"]);
  const monitoringLogging = pickListMatches(text, [
    "Prometheus",
    "Grafana",
    "CloudWatch",
    "ELK",
    "Elastic Stack",
    "Elasticsearch",
    "Logstash",
    "Kibana",
  ]);
  const securityDevsecops = pickListMatches(text, ["Security", "Security Hardening", "DevSecOps"]);
  const databases = pickListMatches(text, ["PostgreSQL", "MySQL", "Redis", "MongoDB"]);
  const programmingScripting = pickListMatches(text, ["Python", "TypeScript", "Java", "Go", "Node.js"]);
  const leadershipArchitecture = pickListMatches(text, [
    "Cloud Architecture",
    "System Design",
    "Microservices",
    "Distributed Systems",
    "API Design",
    "Serverless",
    "AWS Well-Architected",
    "Well Architected",
    "Multi-account",
    "Multi account",
    "Landing zone",
    "AWS Organizations",
    "Architecture",
    "Mentoring",
    "Leadership",
  ]);
  const sreReliability = pickListMatches(text, [
    "SRE",
    "Reliability Engineering",
    "Incident Response",
    "Observability",
    "High Availability",
    "Disaster Recovery",
    "Cost Optimization",
    "SLO",
    "SLI",
    "Error Budget",
    "Error Budgets",
    "On-call",
    "Postmortem",
  ]);

  return {
    cloudPlatforms,
    awsServices,
    containersOrchestration,
    infrastructureAsCode,
    cicd,
    monitoringLogging,
    securityDevsecops,
    databases,
    programmingScripting,
    leadershipArchitecture,
    sreReliability,
  };
}

function deterministicResumeSummary(input: {
  rawText: string;
  yearsText?: string;
  categories: ParsedResumeJson["skillCategories"];
  leadershipIndicators: string[];
  certifications: string[];
}): string {
  const title = inferPrimaryTitle(input.rawText);
  const years = formatYearsText(input.yearsText);

  const highlights = uniqueStrings([
    ...input.categories.cloudPlatforms,
    ...input.categories.containersOrchestration,
    ...input.categories.infrastructureAsCode,
    ...input.categories.cicd,
    ...input.categories.monitoringLogging,
    ...input.categories.securityDevsecops,
    ...input.categories.sreReliability,
  ]).slice(0, 10);

  if (highlights.length === 0) {
    return `${title}: resume text extracted, but no technical skills detected yet.`;
  }

  const core = highlights.slice(0, 7).join(", ");
  const certs = input.certifications.slice(0, 2);
  const certText = certs.length > 0 ? ` Certifications include ${certs.join(" and ")}.` : "";
  const leadText =
    input.leadershipIndicators.length > 0
      ? ` Strengths include ${input.leadershipIndicators.slice(0, 6).join(", ")}.`
      : "";

  const line1 = `${title}${years ? ` with ${years}` : ""} specializing in ${core}.`;
  const line2 = `${certText}${leadText}`.trim();
  return line2 ? `${line1} ${line2}` : line1;
}

function extractLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function escapeForRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTokenRegex(token: string): RegExp {
  const escaped = escapeForRegex(token).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i");
}

function hasListContext(line: string): boolean {
  return /[,|/•·]/.test(line) || /\b(skills|technologies|tech\s*stack|languages|tooling|certifications)\b\s*:/i.test(line);
}

function hasOtherTechOnLine(line: string): boolean {
  return /\b(aws|azure|gcp|kubernetes|docker|terraform|pulumi|linux|python|java|typescript|node\.js|react|sql|postgres|redis|microservices|ci\/cd|prometheus|grafana|cloudwatch|ansible|helm|sre)\b/i.test(
    line,
  );
}

function matchesGo(text: string): boolean {
  if (/\bgolang\b/i.test(text)) return true;
  if (/\bgo\s+language\b/i.test(text)) return true;
  if (/\bgo\s+programming\b/i.test(text)) return true;

  const lines = extractLines(text);
  for (const line of lines) {
    if (!buildTokenRegex("Go").test(line)) continue;
    if (!hasListContext(line)) continue;
    const withoutGo = line.replace(buildTokenRegex("Go"), " ");
    if (hasOtherTechOnLine(withoutGo)) return true;
  }
  return false;
}

function matchesShortSkill(text: string, skill: string): boolean {
  const token = buildTokenRegex(skill);
  const lines = extractLines(text);
  for (const line of lines) {
    if (!token.test(line)) continue;
    if (!hasListContext(line)) continue;
    const without = line.replace(token, " ");
    if (hasOtherTechOnLine(without)) return true;
  }
  return false;
}

function pickListMatches(text: string, dictionary: string[]): string[] {
  const found: string[] = [];
  for (const item of dictionary) {
    if (item === "Go") {
      if (matchesGo(text)) found.push(item);
      continue;
    }
    if (item === "R" || item === "C" || item === "C++" || item === "C#") {
      if (matchesShortSkill(text, item)) found.push(item);
      continue;
    }
    if (buildTokenRegex(item).test(text)) found.push(item);
  }
  return uniqueStrings(found);
}

function parseResumeMock(rawText: string): ParsedResumeJson {
  if (rawText.trim().length === 0) {
    const extractedAt = new Date().toISOString();
    return {
      parsedAt: extractedAt,
      yearsOfExperience: undefined,
      yearsOfExperienceText: undefined,
      skills: [],
      cloudPlatforms: [],
      tools: [],
      certifications: [],
      trainings: [],
      skillCategories: {
        cloudPlatforms: [],
        awsServices: [],
        containersOrchestration: [],
        infrastructureAsCode: [],
        cicd: [],
        monitoringLogging: [],
        securityDevsecops: [],
        databases: [],
        programmingScripting: [],
        leadershipArchitecture: [],
        sreReliability: [],
      },
      leadershipIndicators: [],
      companies: [],
      education: [],
      projects: [],
      rawTextPreview: "",
      extractedTextPreview: "",
      extractionStatus: "failed",
      extractionError: undefined,
      extractionMethod: undefined,
      parser: { provider: "mock", version: "1", extractedAt },
      extraction: { ok: false, status: "failed", message: null, fileType: null, mimeType: null },
    };
  }

  const years = extractYearsOfExperienceInfo(rawText);
  const skillCategories = buildSkillCategories(rawText);
  const technicalSkillCount = uniqueStrings([
    ...skillCategories.cloudPlatforms,
    ...skillCategories.awsServices,
    ...skillCategories.containersOrchestration,
    ...skillCategories.infrastructureAsCode,
    ...skillCategories.cicd,
    ...skillCategories.monitoringLogging,
    ...skillCategories.securityDevsecops,
    ...skillCategories.databases,
    ...skillCategories.programmingScripting,
    ...skillCategories.sreReliability,
  ]).length;

  const isTechnical = technicalSkillCount >= 2;
  const certifications = isTechnical ? extractCertifications(rawText) : [];
  const trainings = isTechnical ? extractTrainings(rawText) : [];
  const leadershipIndicators = isTechnical ? detectLeadershipIndicators(rawText) : [];

  const cloudPlatforms = skillCategories.cloudPlatforms;
  const tools = uniqueStrings([
    ...skillCategories.containersOrchestration,
    ...skillCategories.infrastructureAsCode,
    ...skillCategories.cicd,
    ...skillCategories.monitoringLogging,
    ...skillCategories.databases,
    ...skillCategories.programmingScripting,
    ...pickListMatches(rawText, ["Linux", "Git"]),
  ]).slice(0, 80);

  const skills = uniqueStrings([
    ...skillCategories.leadershipArchitecture,
    ...skillCategories.cloudPlatforms,
    ...skillCategories.awsServices,
    ...skillCategories.containersOrchestration,
    ...skillCategories.infrastructureAsCode,
    ...skillCategories.cicd,
    ...skillCategories.monitoringLogging,
    ...skillCategories.securityDevsecops,
    ...skillCategories.sreReliability,
    ...skillCategories.databases,
    ...skillCategories.programmingScripting,
    ...pickListMatches(rawText, ["SRE", "Incident Response", "Observability", "Security Hardening", "Cost Optimization"]),
  ]).slice(0, 60);

  const lines = extractLines(rawText);
  const companies = uniqueStrings(
    lines
      .filter((l) => /\b(inc|llc|ltd|corp|corporation|company)\b/i.test(l))
      .slice(0, 15),
  );

  const education = uniqueStrings(
    lines
      .filter((l) => /\b(bachelor|master|phd|b\.s\.|m\.s\.|university|college)\b/i.test(l))
      .slice(0, 15),
  );

  const projects = uniqueStrings(
    lines
      .filter((l) => /\b(project|built|implemented|shipped)\b/i.test(l))
      .slice(0, 15),
  );

  const rawTextPreview = rawText.slice(0, 1200);
  const extractedTextPreview = rawTextPreview;

  const extractedAt = new Date().toISOString();

  return {
    parsedAt: extractedAt,
    yearsOfExperience: years.years,
    yearsOfExperienceText: years.text,
    skills,
    cloudPlatforms,
    tools,
    certifications,
    trainings,
    skillCategories,
    leadershipIndicators,
    companies,
    education,
    projects,
    rawTextPreview,
    extractedTextPreview,
    extractionStatus: "success",
    extractionError: undefined,
    extractionMethod: undefined,
    parser: { provider: "mock", version: "1", extractedAt },
    extraction: { ok: true, status: "ok", message: null, fileType: null, mimeType: null },
  };
}

async function buildResumeJson(
  rawText: string,
  extraction: ParsedResumeJson["extraction"],
  meta?: {
    extractionMethod?: string;
    extractionError?: string;
    candidateId?: string;
    resumeFileName?: string | null;
    resumeFileSize?: number;
    resumeMimeType?: string | null;
  },
): Promise<ParsedResumeJson> {
  const parsed = parseResumeMock(rawText);
  const provider = await getStringSetting("ai.provider", "mock");
  const ai = createAiProvider({ provider: provider === "openai" || provider === "gemini" || provider === "claude" ? provider : "mock" });

  const hasText = parsed.extractedTextPreview.trim().length > 0;
  const summary = !extraction.ok
    ? extraction.message ?? "Resume uploaded successfully, but text extraction failed."
    : !hasText
      ? "Resume uploaded successfully, but text extraction produced no readable text."
      : ai.id === "mock"
        ? deterministicResumeSummary({
            rawText,
            yearsText: parsed.yearsOfExperienceText,
            categories: parsed.skillCategories,
            leadershipIndicators: parsed.leadershipIndicators,
            certifications: parsed.certifications,
          })
        : (
            await ai.generateText({
              prompt: `Summarize this resume in 2-3 sentences for interview preparation.\n\n${parsed.extractedTextPreview}`,
            })
          ).text;

  const extractionStatus: ParsedResumeJson["extractionStatus"] = extraction.ok ? "success" : "failed";
  const extractionError =
    extraction.ok ? undefined : meta?.extractionError ?? extraction.message ?? "Text extraction failed.";
  const extractionMethod = meta?.extractionMethod;
  const parsedAt = new Date().toISOString();

  return {
    ...parsed,
    parsedAt,
    candidateId: meta?.candidateId,
    resumeFileName: meta?.resumeFileName ?? null,
    resumeFileSize: meta?.resumeFileSize,
    resumeMimeType: meta?.resumeMimeType ?? null,
    summary,
    parser: { ...parsed.parser, provider: ai.id },
    extraction,
    extractionStatus,
    extractionError,
    extractionMethod,
  };
}

export async function parseAndStoreCandidateResume({
  candidateId,
  organizationId,
  absoluteFilePath,
  mimeType,
  fileName,
}: {
  candidateId: string;
  organizationId: string;
  absoluteFilePath: string;
  mimeType: string | null;
  fileName?: string | null;
}) {
  const enabled = await getBooleanSetting("resumeParsing.enabled", true);
  if (!enabled) return { parsed: false, warning: "Resume parsing is disabled." };

  const debug = process.env.RESUME_PARSING_DEBUG === "1" || process.env.NODE_ENV !== "production";

  const db = prisma as unknown as Db;
  const candidate = await db.candidate.findFirst({
    where: { id: candidateId, organizationId },
    select: { id: true },
  });
  if (!candidate) throw new Error("Candidate not found.");

  const buffer = await readFile(absoluteFilePath);
  if (debug) {
    console.info(
      `[resume-service] parse start candidateId=${candidateId} fileName=${fileName ?? ""} mime=${mimeType ?? ""} bytes=${buffer.length}`,
    );
  }

  const { text, extraction, extractionMethod, extractionError } = await extractResumeText({ buffer, mimeType });
  if (debug) {
    console.info(
      `[resume-service] parse extract status=${extraction.status} ok=${extraction.ok} method=${extractionMethod ?? ""} textLen=${text.length} err=${
        extractionError ? truncateForLog(extractionError) : ""
      }`,
    );
  }

  const parsedResumeJson = await buildResumeJson(text, extraction, {
    extractionMethod,
    extractionError: extractionError ? truncateForLog(extractionError) : undefined,
    candidateId,
    resumeFileName: fileName ?? null,
    resumeFileSize: buffer.length,
    resumeMimeType: mimeType ?? null,
  });

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.candidateSkillMatch.deleteMany({
      where: { candidateId, sourceType: SourceType.RESUME },
    });

    const skills = uniqueStrings(
      [
        ...parsedResumeJson.skills,
        ...parsedResumeJson.cloudPlatforms,
        ...parsedResumeJson.tools,
      ].filter((s) => typeof s === "string" && s.trim().length > 0),
    ).slice(0, 80);

    if (skills.length > 0) {
      const skillRows = await upsertSkillsByName(tx, skills);
      const skillBySlug = new Map(skillRows.map((s) => [s.slug, s.id]));

      const matchRows = skills
        .map((name) => {
          const slug = slugifySkillName(name);
          const skillId = slug ? skillBySlug.get(slug) : undefined;
          if (!skillId) return null;
          return { skillId, name };
        })
        .filter((v): v is { skillId: string; name: string } => Boolean(v));

      if (matchRows.length > 0) {
        await tx.candidateSkillMatch.createMany({
          data: matchRows.map((m) => ({
            candidateId,
            skillId: m.skillId,
            sourceType: SourceType.RESUME,
            confidence: 0.75,
          })),
          skipDuplicates: true,
        });
      }
    }

    const txDb = tx as unknown as TxDb;
    await txDb.candidate.updateMany({
      where: { id: candidateId, organizationId },
      data: { parsedResumeJson: parsedResumeJson as never },
    });
  });

  return extraction.ok
    ? { parsed: true }
    : {
        parsed: false,
        warning:
          extraction.status === "unsupported"
            ? "Uploaded, but text extraction is not available yet."
            : "Uploaded, but parsing failed.",
      };
}
