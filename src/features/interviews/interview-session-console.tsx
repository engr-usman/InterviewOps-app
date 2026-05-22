"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Recommendation } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  evaluationStatusValues,
  saveQuestionEvaluationSchema,
  saveScorecardSchema,
  type EvaluationStatus,
  type SaveQuestionEvaluationValues,
  type SaveScorecardValues,
} from "@/features/interviews/interview-evaluation-schema";
import { saveInterviewQuestionEvaluationAction, saveInterviewScorecardAction } from "@/app/(dashboard)/interviews/session-actions";
import {
  acceptFollowUpQuestionAction,
  generateEvaluationInsightAction,
  generateInterviewSummaryAction,
  suggestFollowUpQuestionsAction,
} from "@/app/(dashboard)/ai/actions";

export type SessionCandidate = {
  id: string;
  fullName: string;
  email: string | null;
  seniorityLevel: string | null;
};

export type SessionJobDescription = {
  id: string;
  title: string;
  seniorityLevel: string | null;
};

export type SessionQuestion = {
  id: string;
  order: number;
  topic: string | null;
  questionText: string;
  type: string;
  difficulty: string;
  tagsJson: unknown | null;
  evaluation: {
    id: string;
    score: number | null;
    notesText: string | null;
    metadataJson: unknown | null;
    updatedAt: string;
  } | null;
};

export type SessionScorecard = {
  id: string;
  recommendation: Recommendation | null;
  overallScore: number | null;
  summaryText: string | null;
  scorecardJson: unknown;
} | null;

function tagsToList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((t) => typeof t === "string") as string[];
}

function getEvalStatus(q: SessionQuestion): EvaluationStatus {
  const meta = q.evaluation?.metadataJson as { status?: unknown } | null;
  const s = meta?.status;
  if (typeof s === "string" && (evaluationStatusValues as readonly string[]).includes(s)) return s as EvaluationStatus;
  if (typeof q.evaluation?.score === "number") return "EVALUATED";
  return "PENDING";
}

function getEvalMeta(q: SessionQuestion): { strengthsNotes: string; weaknessesNotes: string } {
  const meta = q.evaluation?.metadataJson as { strengthsNotes?: unknown; weaknessesNotes?: unknown } | null;
  return {
    strengthsNotes: typeof meta?.strengthsNotes === "string" ? meta.strengthsNotes : "",
    weaknessesNotes: typeof meta?.weaknessesNotes === "string" ? meta.weaknessesNotes : "",
  };
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

export function InterviewSessionConsole({
  interviewId,
  interviewStatus,
  candidate,
  jobDescription,
  questions,
  scorecard,
}: {
  interviewId: string;
  interviewStatus: string;
  candidate: SessionCandidate;
  jobDescription: SessionJobDescription;
  questions: SessionQuestion[];
  scorecard: SessionScorecard;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromUrl = searchParams.get("q");

  const selectedId = React.useMemo(() => {
    if (selectedFromUrl && questions.some((q) => q.id === selectedFromUrl)) return selectedFromUrl;
    return questions[0]?.id ?? null;
  }, [questions, selectedFromUrl]);

  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [followUps, setFollowUps] = React.useState<Array<{ questionText: string; intent: string; tags: string[] }> | null>(
    null,
  );
  const [followUpLoading, setFollowUpLoading] = React.useState(false);
  const [aiInsight, setAiInsight] = React.useState<Record<string, unknown> | null>(null);
  const [aiInsightLoading, setAiInsightLoading] = React.useState(false);
  const [aiSummaryLoading, setAiSummaryLoading] = React.useState(false);

  const selectedQuestion = React.useMemo(
    () => (selectedId ? questions.find((q) => q.id === selectedId) ?? null : null),
    [questions, selectedId],
  );

  const progress = React.useMemo(() => {
    const total = questions.length;
    const evaluated = questions.filter((q) => getEvalStatus(q) === "EVALUATED").length;
    const remaining = Math.max(0, total - evaluated);
    const pct = total === 0 ? 0 : Math.round((evaluated / total) * 100);
    const scores = questions.map((q) => q.evaluation?.score).filter((v): v is number => typeof v === "number");
    const technicalAverage = avg(scores);
    return { total, evaluated, remaining, pct, technicalAverage };
  }, [questions]);

  const evaluationForm = useForm<SaveQuestionEvaluationValues>({
    resolver: zodResolver(saveQuestionEvaluationSchema),
    defaultValues: {
      score: undefined,
      status: "PENDING",
      strengthsNotes: "",
      weaknessesNotes: "",
      overallNotes: "",
    },
  });

  React.useEffect(() => {
    if (!selectedQuestion) return;
    const meta = getEvalMeta(selectedQuestion);
    evaluationForm.reset({
      score: selectedQuestion.evaluation?.score ?? undefined,
      status: getEvalStatus(selectedQuestion),
      strengthsNotes: meta.strengthsNotes,
      weaknessesNotes: meta.weaknessesNotes,
      overallNotes: selectedQuestion.evaluation?.notesText ?? "",
    });
  }, [evaluationForm, selectedQuestion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scorecardForm = useForm<SaveScorecardValues>({
    resolver: zodResolver(saveScorecardSchema),
    defaultValues: {
      recommendation: scorecard?.recommendation ?? "",
      communicationScore: undefined,
      problemSolvingScore: undefined,
      cloudDevOpsScore: undefined,
      interviewSummary: scorecard?.summaryText ?? "",
      finalRecommendation: "",
      hiringConcerns: "",
      strongAreas: "",
    },
  });

  React.useEffect(() => {
    const json = scorecard?.scorecardJson as
      | null
      | {
          communicationScore?: unknown;
          problemSolvingScore?: unknown;
          cloudDevOpsScore?: unknown;
          finalRecommendation?: unknown;
          hiringConcerns?: unknown;
          strongAreas?: unknown;
        };

    scorecardForm.reset({
      recommendation: scorecard?.recommendation ?? "",
      communicationScore: typeof json?.communicationScore === "number" ? json.communicationScore : undefined,
      problemSolvingScore: typeof json?.problemSolvingScore === "number" ? json.problemSolvingScore : undefined,
      cloudDevOpsScore: typeof json?.cloudDevOpsScore === "number" ? json.cloudDevOpsScore : undefined,
      interviewSummary: scorecard?.summaryText ?? "",
      finalRecommendation: typeof json?.finalRecommendation === "string" ? json.finalRecommendation : "",
      hiringConcerns: typeof json?.hiringConcerns === "string" ? json.hiringConcerns : "",
      strongAreas: typeof json?.strongAreas === "string" ? json.strongAreas : "",
    });
  }, [scorecard?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectClassName = cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  );

  const setSelectedQuestionId = (nextId: string) => {
    if (evaluationForm.formState.isDirty) {
      const ok = window.confirm("You have unsaved changes for this question. Continue without saving?");
      if (!ok) return;
    }
    setNotice(null);
    setError(null);
    setFollowUps(null);
    setAiInsight(null);
    const url = `/interviews/${interviewId}/session?q=${encodeURIComponent(nextId)}`;
    router.replace(url);
  };

  const onSaveEvaluation = evaluationForm.handleSubmit(async (values) => {
    if (!selectedQuestion) return;
    setError(null);
    setNotice(null);
    const result = await saveInterviewQuestionEvaluationAction(interviewId, selectedQuestion.id, values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice("Evaluation saved.");
    router.refresh();
  });

  const onNextQuestion = async () => {
    if (!selectedQuestion) return;
    const ordered = [...questions].sort((a, b) => a.order - b.order);
    const indexInOrdered = ordered.findIndex((q) => q.id === selectedQuestion.id);
    if (indexInOrdered === -1) return;

    const findNext = () => {
      for (let offset = 1; offset <= ordered.length; offset += 1) {
        const q = ordered[(indexInOrdered + offset) % ordered.length];
        if (getEvalStatus(q) !== "EVALUATED") return q.id;
      }
      return ordered[(indexInOrdered + 1) % ordered.length]?.id ?? selectedQuestion.id;
    };

    const nextId = findNext();
    setSelectedQuestionId(nextId);
  };

  const onSuggestFollowUp = async () => {
    if (!selectedQuestion) return;
    setError(null);
    setNotice(null);
    setFollowUps(null);
    setFollowUpLoading(true);
    try {
      const result = await suggestFollowUpQuestionsAction(interviewId, selectedQuestion.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFollowUps(result.data.followUps);
      setNotice("Follow-up suggestions generated.");
    } finally {
      setFollowUpLoading(false);
    }
  };

  const onAcceptFollowUp = async (text: string) => {
    setError(null);
    setNotice(null);
    const result = await acceptFollowUpQuestionAction(interviewId, text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice("Follow-up added to interview.");
    setFollowUps(null);
    router.refresh();
  };

  const onGenerateAiInsight = async () => {
    if (!selectedQuestion) return;
    setError(null);
    setNotice(null);
    setAiInsight(null);
    setAiInsightLoading(true);
    try {
      const result = await generateEvaluationInsightAction(interviewId, selectedQuestion.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAiInsight(result.data.insight);
      setNotice("AI insight generated.");
    } finally {
      setAiInsightLoading(false);
    }
  };

  const onApplyAiSuggestedScore = () => {
    const raw = aiInsight?.suggestedScore;
    if (typeof raw !== "number" || Number.isNaN(raw)) return;
    evaluationForm.setValue("score", raw, { shouldDirty: true });
  };

  const onSaveScorecard = scorecardForm.handleSubmit(async (values) => {
    setError(null);
    setNotice(null);
    const result = await saveInterviewScorecardAction(interviewId, values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice("Scorecard saved.");
    router.refresh();
  });

  const onGenerateAiSummary = async () => {
    setError(null);
    setNotice(null);
    setAiSummaryLoading(true);
    try {
      const result = await generateInterviewSummaryAction(interviewId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const summary = result.data.summary as Record<string, unknown>;
      const interviewSummary = typeof summary.interviewSummary === "string" ? summary.interviewSummary : "";
      const strengths = Array.isArray(summary.strengthsSummary)
        ? (summary.strengthsSummary as string[]).filter((s) => typeof s === "string")
        : [];
      const weaknesses = Array.isArray(summary.weaknessesSummary)
        ? (summary.weaknessesSummary as string[]).filter((s) => typeof s === "string")
        : [];
      const reasoning = typeof summary.hiringRecommendationReasoning === "string" ? summary.hiringRecommendationReasoning : "";
      const verdict = typeof summary.finalVerdictExplanation === "string" ? summary.finalVerdictExplanation : "";

      scorecardForm.setValue("interviewSummary", interviewSummary, { shouldDirty: true });
      scorecardForm.setValue("strongAreas", strengths.map((s) => `- ${s}`).join("\n"), { shouldDirty: true });
      scorecardForm.setValue("hiringConcerns", weaknesses.map((s) => `- ${s}`).join("\n"), { shouldDirty: true });
      scorecardForm.setValue("finalRecommendation", `${reasoning}${reasoning && verdict ? "\n\n" : ""}${verdict}`, {
        shouldDirty: true,
      });
      if (result.data.suggestedRecommendation) {
        scorecardForm.setValue("recommendation", result.data.suggestedRecommendation, { shouldDirty: true });
      }

      setNotice("AI summary generated. Review and save when ready.");
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const questionTags = selectedQuestion ? tagsToList(selectedQuestion.tagsJson) : [];
  const scorecardOverall = scorecard?.overallScore ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Interview session</div>
          <div className="text-2xl font-semibold">{candidate.fullName}</div>
          <div className="text-sm text-muted-foreground">{jobDescription.title}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/interviews/${interviewId}`}>Back to Interview Detail</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Context</CardTitle>
              <CardDescription>Candidate, role, status, and progress.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <div className="text-muted-foreground">Candidate</div>
                  <div>{candidate.fullName}</div>
                  <div className="text-muted-foreground">{candidate.email ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Candidate seniority</div>
                  <div>{candidate.seniorityLevel ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Role</div>
                  <div>{jobDescription.title}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Role seniority</div>
                  <div>{jobDescription.seniorityLevel ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Interview status</div>
                  <div>{interviewStatus}</div>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">Progress</div>
                  <div className="text-muted-foreground">{progress.pct}%</div>
                </div>
                <div className="mt-2 h-2 w-full rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${progress.pct}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <div>Total: {progress.total}</div>
                  <div>Evaluated: {progress.evaluated}</div>
                  <div>Remaining: {progress.remaining}</div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">Technical average:</span>{" "}
                  <span>{typeof progress.technicalAverage === "number" ? progress.technicalAverage.toFixed(2) : "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questions</CardTitle>
              <CardDescription>Select a question to evaluate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {questions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No interview questions yet.</div>
              ) : (
                <div className="space-y-2">
                  {questions
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((q) => {
                      const status = getEvalStatus(q);
                      const isSelected = q.id === selectedQuestion?.id;
                      const badgeClass =
                        status === "EVALUATED"
                          ? "bg-emerald-100 text-emerald-800"
                          : status === "IN_REVIEW"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700";

                      return (
                        <button
                          key={q.id}
                          type="button"
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                            isSelected ? "border-primary" : "hover:bg-muted/40",
                          )}
                          onClick={() => setSelectedQuestionId(q.id)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">
                              {q.order}. {q.topic ?? "—"}
                            </div>
                            <span className={cn("rounded-full px-2 py-0.5 text-xs", badgeClass)}>{status}</span>
                          </div>
                          <div className="mt-1 text-muted-foreground line-clamp-2">{q.questionText}</div>
                        </button>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation</CardTitle>
              <CardDescription>Score and notes for the selected question.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedQuestion ? (
                <div className="text-sm text-muted-foreground">Select a question to begin.</div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Question {selectedQuestion.order} • {selectedQuestion.type} • {selectedQuestion.difficulty}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{selectedQuestion.questionText}</div>
                    {questionTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {questionTags.slice(0, 12).map((t) => (
                          <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <form onSubmit={onSaveEvaluation} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="score">Score (1–10)</Label>
                        <Input
                          id="score"
                          type="number"
                          min={1}
                          max={10}
                          {...evaluationForm.register("score", { valueAsNumber: true })}
                        />
                        {evaluationForm.formState.errors.score?.message ? (
                          <p className="text-sm text-destructive">{String(evaluationForm.formState.errors.score.message)}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="status">Status</Label>
                        <select id="status" className={selectClassName} {...evaluationForm.register("status")}>
                          <option value="PENDING">Pending</option>
                          <option value="IN_REVIEW">In Review</option>
                          <option value="EVALUATED">Evaluated</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="strengthsNotes">Strengths</Label>
                        <textarea
                          id="strengthsNotes"
                          className={cn(
                            "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          )}
                          {...evaluationForm.register("strengthsNotes")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weaknessesNotes">Weaknesses</Label>
                        <textarea
                          id="weaknessesNotes"
                          className={cn(
                            "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          )}
                          {...evaluationForm.register("weaknessesNotes")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="overallNotes">Overall notes/comments</Label>
                      <textarea
                        id="overallNotes"
                        className={cn(
                          "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        )}
                        {...evaluationForm.register("overallNotes")}
                      />
                    </div>

                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="submit" disabled={evaluationForm.formState.isSubmitting}>
                        {evaluationForm.formState.isSubmitting ? "Saving..." : "Save Evaluation"}
                      </Button>
                      <Button type="button" variant="outline" onClick={onNextQuestion}>
                        Next Question
                      </Button>
                    </div>

                    <div className="h-px bg-border" />

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">AI assistant</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="outline" onClick={onSuggestFollowUp} disabled={followUpLoading}>
                            {followUpLoading ? "Generating..." : "Suggest Follow-up"}
                          </Button>
                          <Button type="button" variant="outline" onClick={onGenerateAiInsight} disabled={aiInsightLoading}>
                            {aiInsightLoading ? "Generating..." : "Generate AI Insight"}
                          </Button>
                          <Button type="button" variant="outline" onClick={onApplyAiSuggestedScore} disabled={!aiInsight}>
                            Apply Suggested Score
                          </Button>
                        </div>
                      </div>

                      {followUps ? (
                        <div className="space-y-2 rounded-md border p-3">
                          <div className="text-sm text-muted-foreground">Follow-up suggestions</div>
                          <div className="space-y-2">
                            {followUps.map((f, idx) => (
                              <div key={`${idx}-${f.questionText}`} className="rounded-md border p-3">
                                <div className="font-medium">{f.questionText}</div>
                                {f.intent ? <div className="mt-1 text-sm text-muted-foreground">{f.intent}</div> : null}
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Button type="button" size="sm" onClick={() => onAcceptFollowUp(f.questionText)}>
                                    Accept
                                  </Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => setFollowUps(null)}>
                                    Discard
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {aiInsight ? (
                        <div className="space-y-2 rounded-md border p-3">
                          <div className="text-sm text-muted-foreground">Evaluation insight</div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-muted-foreground">Suggested score</div>
                              <div>
                                {typeof aiInsight.suggestedScore === "number" && !Number.isNaN(aiInsight.suggestedScore)
                                  ? aiInsight.suggestedScore
                                  : "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Confidence</div>
                              <div>{typeof aiInsight.confidenceAssessment === "string" ? aiInsight.confidenceAssessment : "—"}</div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="text-muted-foreground">Technical depth</div>
                              <div className="text-muted-foreground">
                                {typeof aiInsight.technicalDepthAssessment === "string" ? aiInsight.technicalDepthAssessment : "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Strong signals</div>
                              <div className="text-muted-foreground">
                                {Array.isArray(aiInsight.strongSignals)
                                  ? (aiInsight.strongSignals as string[]).slice(0, 6).join(", ")
                                  : "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Red flags</div>
                              <div className="text-muted-foreground">
                                {Array.isArray(aiInsight.redFlags) ? (aiInsight.redFlags as string[]).slice(0, 6).join(", ") : "—"}
                              </div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="text-muted-foreground">Missing concepts</div>
                              <div className="text-muted-foreground">
                                {Array.isArray(aiInsight.missingConcepts)
                                  ? (aiInsight.missingConcepts as string[]).slice(0, 10).join(", ")
                                  : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </form>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scorecard</CardTitle>
              <CardDescription>Manual scorecard and recommendation (no AI evaluation yet).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Technical avg</div>
                  <div className="text-lg font-semibold">
                    {typeof progress.technicalAverage === "number" ? progress.technicalAverage.toFixed(2) : "—"}
                  </div>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Completion</div>
                  <div className="text-lg font-semibold">{progress.pct}%</div>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Overall score</div>
                  <div className="text-lg font-semibold">{typeof scorecardOverall === "number" ? scorecardOverall.toFixed(2) : "—"}</div>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Recommendation</div>
                  <div className="text-lg font-semibold">{scorecard?.recommendation ?? "—"}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={onGenerateAiSummary} disabled={aiSummaryLoading}>
                  {aiSummaryLoading ? "Generating..." : "Generate AI Summary"}
                </Button>
              </div>

              <form onSubmit={onSaveScorecard} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recommendation">Recommendation</Label>
                    <select id="recommendation" className={selectClassName} {...scorecardForm.register("recommendation")}>
                      <option value="">—</option>
                      <option value="STRONG_HIRE">STRONG_HIRE</option>
                      <option value="HIRE">HIRE</option>
                      <option value="BORDERLINE">BORDERLINE</option>
                      <option value="NO_HIRE">NO_HIRE</option>
                      <option value="STRONG_NO_HIRE">STRONG_NO_HIRE</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="communicationScore">Communication (placeholder)</Label>
                    <Input
                      id="communicationScore"
                      type="number"
                      min={1}
                      max={10}
                      {...scorecardForm.register("communicationScore", { valueAsNumber: true })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="problemSolvingScore">Problem solving (placeholder)</Label>
                    <Input
                      id="problemSolvingScore"
                      type="number"
                      min={1}
                      max={10}
                      {...scorecardForm.register("problemSolvingScore", { valueAsNumber: true })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cloudDevOpsScore">Cloud/DevOps (placeholder)</Label>
                    <Input
                      id="cloudDevOpsScore"
                      type="number"
                      min={1}
                      max={10}
                      {...scorecardForm.register("cloudDevOpsScore", { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interviewSummary">Interview summary</Label>
                  <textarea
                    id="interviewSummary"
                    className={cn(
                      "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                    {...scorecardForm.register("interviewSummary")}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="strongAreas">Strong areas</Label>
                    <textarea
                      id="strongAreas"
                      className={cn(
                        "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      )}
                      {...scorecardForm.register("strongAreas")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hiringConcerns">Hiring concerns</Label>
                    <textarea
                      id="hiringConcerns"
                      className={cn(
                        "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      )}
                      {...scorecardForm.register("hiringConcerns")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="finalRecommendation">Final recommendation notes</Label>
                  <textarea
                    id="finalRecommendation"
                    className={cn(
                      "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                    {...scorecardForm.register("finalRecommendation")}
                  />
                </div>

                {scorecardForm.formState.errors.communicationScore?.message ? (
                  <p className="text-sm text-destructive">{String(scorecardForm.formState.errors.communicationScore.message)}</p>
                ) : null}

                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={scorecardForm.formState.isSubmitting}>
                    {scorecardForm.formState.isSubmitting ? "Saving..." : "Save Scorecard"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
