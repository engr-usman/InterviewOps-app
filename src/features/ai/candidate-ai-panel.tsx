"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateCandidateAiAnalysisAction } from "@/app/(dashboard)/ai/actions";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string") as string[];
}

export function CandidateAiPanel({ candidateId, aiMetadataJson }: { candidateId: string; aiMetadataJson: unknown }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const analysis = React.useMemo(() => {
    const root = asRecord(aiMetadataJson);
    const resumeAnalysis = asRecord(root?.resumeAnalysis);
    return {
      profileSummary: typeof resumeAnalysis?.profileSummary === "string" ? (resumeAnalysis.profileSummary as string) : null,
      strengths: asStringArray(resumeAnalysis?.strengths),
      weaknesses: asStringArray(resumeAnalysis?.weaknesses),
      likelySeniorityAssessment:
        typeof resumeAnalysis?.likelySeniorityAssessment === "string"
          ? (resumeAnalysis.likelySeniorityAssessment as string)
          : null,
      interviewRiskAreas: asStringArray(resumeAnalysis?.interviewRiskAreas),
      suggestedFocusTopics: asStringArray(resumeAnalysis?.suggestedFocusTopics),
      generatedAt: typeof root?.generatedAt === "string" ? (root.generatedAt as string) : null,
      provider: typeof root?.provider === "string" ? (root.provider as string) : null,
    };
  }, [aiMetadataJson]);

  const onGenerate = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const result = await generateCandidateAiAnalysisAction(candidateId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice("AI analysis generated.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const hasAnalysis = Boolean(analysis.profileSummary || analysis.strengths.length || analysis.weaknesses.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI resume analysis</CardTitle>
        <CardDescription>Premium AI insights for interview preparation. Human judgment remains final.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

        {hasAnalysis ? (
          <div className="space-y-3">
            <div>
              <div className="text-muted-foreground">Profile summary</div>
              <div className="whitespace-pre-wrap">{analysis.profileSummary ?? "—"}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Strengths</div>
                <div className="text-muted-foreground">{analysis.strengths.slice(0, 8).join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Weaknesses</div>
                <div className="text-muted-foreground">{analysis.weaknesses.slice(0, 8).join(", ") || "—"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-muted-foreground">Suggested focus topics</div>
                <div className="text-muted-foreground">{analysis.suggestedFocusTopics.slice(0, 10).join(", ") || "—"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-muted-foreground">Likely seniority assessment</div>
                <div>{analysis.likelySeniorityAssessment ?? "—"}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {analysis.provider && analysis.provider !== "mock" ? `Provider: ${analysis.provider}` : null}
              {analysis.generatedAt ? ` • Generated: ${analysis.generatedAt}` : null}
            </div>
          </div>
        ) : (
          <div className="rounded-md border p-4 text-muted-foreground">
            No AI analysis yet. Generate to see strengths, weaknesses, and interview focus areas.
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button type="button" onClick={onGenerate} disabled={loading}>
            {loading ? "Generating..." : hasAnalysis ? "Regenerate AI Analysis" : "Generate AI Analysis"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
