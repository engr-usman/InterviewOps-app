"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateJobDescriptionAiAnalysisAction } from "@/app/(dashboard)/ai/actions";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string") as string[];
}

export function JobDescriptionAiPanel({
  jobDescriptionId,
  aiMetadataJson,
}: {
  jobDescriptionId: string;
  aiMetadataJson: unknown;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const analysis = React.useMemo(() => {
    const root = asRecord(aiMetadataJson);
    const jdAnalysis = asRecord(root?.jdAnalysis);
    return {
      summary: typeof jdAnalysis?.summary === "string" ? (jdAnalysis.summary as string) : null,
      keyTechnicalRequirements: asStringArray(jdAnalysis?.keyTechnicalRequirements),
      criticalSkills: asStringArray(jdAnalysis?.criticalSkills),
      expectedCompetencyAreas: asStringArray(jdAnalysis?.expectedCompetencyAreas),
      suggestedInterviewDomains: asStringArray(jdAnalysis?.suggestedInterviewDomains),
      generatedAt: typeof root?.generatedAt === "string" ? (root.generatedAt as string) : null,
      provider: typeof root?.provider === "string" ? (root.provider as string) : null,
    };
  }, [aiMetadataJson]);

  const hasAnalysis = Boolean(analysis.summary || analysis.criticalSkills.length || analysis.suggestedInterviewDomains.length);

  const onGenerate = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const result = await generateJobDescriptionAiAnalysisAction(jobDescriptionId);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI job description analysis</CardTitle>
        <CardDescription>AI summary of key requirements and suggested interview domains.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

        {hasAnalysis ? (
          <div className="space-y-3">
            <div>
              <div className="text-muted-foreground">Summary</div>
              <div className="whitespace-pre-wrap">{analysis.summary ?? "—"}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Critical skills</div>
                <div className="text-muted-foreground">{analysis.criticalSkills.slice(0, 10).join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Competency areas</div>
                <div className="text-muted-foreground">{analysis.expectedCompetencyAreas.slice(0, 10).join(", ") || "—"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-muted-foreground">Suggested interview domains</div>
                <div className="text-muted-foreground">{analysis.suggestedInterviewDomains.slice(0, 12).join(", ") || "—"}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {analysis.provider ? `Provider: ${analysis.provider}` : null}
              {analysis.generatedAt ? ` • Generated: ${analysis.generatedAt}` : null}
            </div>
          </div>
        ) : (
          <div className="rounded-md border p-4 text-muted-foreground">
            No AI analysis yet. Generate to see critical skills and interview domains.
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

