"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Recommendation } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RecommendationBadge } from "@/components/ui/recommendation-badge";
import { cn } from "@/lib/utils";
import {
  evaluationStatusValues,
  saveQuestionEvaluationSchema,
  saveScorecardSchema,
  type EvaluationStatus,
  type SaveQuestionEvaluationValues,
  type SaveScorecardValues,
} from "@/features/interviews/interview-evaluation-schema";
import { QuestionScoreBadge } from "@/features/interviews/question-score-badge";
import { getScoreBand } from "@/features/interviews/score-band";
import {
  addAdHocInterviewQuestionAction,
  completeInterviewAction,
  saveInterviewQuestionEvaluationAction,
  saveInterviewScorecardAction,
} from "@/app/(dashboard)/interviews/session-actions";
import { addAdHocQuestionSchema, type AddAdHocQuestionValues } from "@/features/interviews/interview-question-schema";
import {
  acceptFollowUpQuestionAction,
  generateEvaluationInsightAction,
  generateInterviewSummaryAction,
  suggestFollowUpQuestionsAction,
} from "@/app/(dashboard)/ai/actions";
import { generateInterviewReportAndRedirectAction } from "@/app/(dashboard)/reports/actions";

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
  metadataJson: unknown;
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

function computeOverallScore({
  technicalAverage,
  communication,
  problemSolving,
  interviewerTechnicalAssessment,
}: {
  technicalAverage: number | null;
  communication: number | null;
  problemSolving: number | null;
  interviewerTechnicalAssessment: number | null;
}): number | null {
  if (typeof technicalAverage !== "number") return null;
  if (typeof communication !== "number") return null;
  if (typeof problemSolving !== "number") return null;
  if (typeof interviewerTechnicalAssessment !== "number") return null;
  const overall =
    technicalAverage * 0.5 + communication * 0.15 + problemSolving * 0.2 + interviewerTechnicalAssessment * 0.15;
  return Math.round(overall * 100) / 100;
}

function autoRecommendation(overallScore: number | null): Recommendation | null {
  if (typeof overallScore !== "number") return null;
  if (overallScore >= 8.5) return "STRONG_HIRE";
  if (overallScore >= 7.0) return "HIRE";
  if (overallScore >= 6.0) return "BORDERLINE";
  return "NO_HIRE";
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
  latestReportId,
  canViewReports,
  canGenerateReports,
}: {
  interviewId: string;
  interviewStatus: string;
  candidate: SessionCandidate;
  jobDescription: SessionJobDescription;
  questions: SessionQuestion[];
  scorecard: SessionScorecard;
  latestReportId: string | null;
  canViewReports: boolean;
  canGenerateReports: boolean;
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
  const [isCompletingInterview, setIsCompletingInterview] = React.useState(false);
  const [isSavingEvaluation, setIsSavingEvaluation] = React.useState(false);
  const [isAddingAdHoc, setIsAddingAdHoc] = React.useState(false);
  const [showAdHoc, setShowAdHoc] = React.useState(false);
  const isControlledQuestionNavigationRef = React.useRef(false);

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
      score: Number.NaN,
      status: "PENDING",
      strengthsNotes: "",
      weaknessesNotes: "",
      overallNotes: "",
    },
  });

  const evaluationBusy = evaluationForm.formState.isSubmitting;
  const isReadOnly = interviewStatus === "COMPLETED";
  const readOnlyTooltip = "Interview is completed. Session is in read-only mode.";

  const adHocForm = useForm<AddAdHocQuestionValues>({
    resolver: zodResolver(addAdHocQuestionSchema),
    defaultValues: {
      questionText: "",
      topic: "",
      difficulty: "",
    } as unknown as AddAdHocQuestionValues,
  });

  React.useEffect(() => {
    if (!selectedQuestion) return;
    const meta = getEvalMeta(selectedQuestion);
    evaluationForm.reset({
      score: typeof selectedQuestion.evaluation?.score === "number" ? selectedQuestion.evaluation.score : Number.NaN,
      status: getEvalStatus(selectedQuestion),
      strengthsNotes: meta.strengthsNotes,
      weaknessesNotes: meta.weaknessesNotes,
      overallNotes: selectedQuestion.evaluation?.notesText ?? "",
    });
  }, [evaluationForm, selectedQuestion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSavingEvaluation) return;
      if (isControlledQuestionNavigationRef.current) return;
      if (!evaluationForm.formState.isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [evaluationForm.formState.isDirty, isSavingEvaluation]);

  const scorecardForm = useForm<SaveScorecardValues>({
    resolver: zodResolver(saveScorecardSchema),
    defaultValues: {
      communicationScore: undefined,
      problemSolvingScore: undefined,
      interviewerTechnicalAssessment: undefined,
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
          interviewerTechnicalAssessment?: unknown;
          finalRecommendation?: unknown;
          hiringConcerns?: unknown;
          strongAreas?: unknown;
        };

    scorecardForm.reset({
      communicationScore: typeof json?.communicationScore === "number" ? json.communicationScore : undefined,
      problemSolvingScore: typeof json?.problemSolvingScore === "number" ? json.problemSolvingScore : undefined,
      interviewerTechnicalAssessment:
        typeof json?.interviewerTechnicalAssessment === "number" ? json.interviewerTechnicalAssessment : undefined,
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

  const setSelectedQuestionId = (nextId: string, opts?: { keepNotice?: boolean }) => {
    if (evaluationBusy || isSavingEvaluation) return;
    if (evaluationForm.formState.isDirty && !isControlledQuestionNavigationRef.current) {
      const ok = window.confirm("You have unsaved changes for this question. Continue without saving?");
      if (!ok) return;
    }
    if (!opts?.keepNotice) setNotice(null);
    setError(null);
    setFollowUps(null);
    setAiInsight(null);
    const url = `/interviews/${interviewId}/session?q=${encodeURIComponent(nextId)}`;
    router.replace(url);
    if (isControlledQuestionNavigationRef.current) {
      window.setTimeout(() => {
        isControlledQuestionNavigationRef.current = false;
      }, 0);
    }
  };

  const showBriefNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((cur) => (cur === msg ? null : cur));
    }, 1200);
  };

  const saveCurrentEvaluationOrSetError = async (): Promise<{ ok: boolean }> => {
    if (!selectedQuestion) return { ok: false };
    if (isReadOnly) return { ok: true };

    const values = evaluationForm.getValues();

    const scoreRaw = values.score;
    const scoreIsValid = typeof scoreRaw === "number" && !Number.isNaN(scoreRaw);
    if (!scoreIsValid) {
      setError("Score is required before moving to another question.");
      return { ok: false };
    }
    if (!values.status) {
      setError("Status is required before moving to another question.");
      return { ok: false };
    }
    if (!values.strengthsNotes?.trim()) {
      setError("Strengths is required before moving to another question.");
      return { ok: false };
    }
    if (!values.weaknessesNotes?.trim()) {
      setError("Weaknesses is required before moving to another question.");
      return { ok: false };
    }
    if (!values.overallNotes?.trim()) {
      setError("Overall notes/comments is required before moving to another question.");
      return { ok: false };
    }

    setError(null);
    const result = await saveInterviewQuestionEvaluationAction(interviewId, selectedQuestion.id, values);
    if (!result.ok) {
      setError(result.error);
      return { ok: false };
    }

    evaluationForm.reset({
      score: scoreRaw,
      status: values.status,
      strengthsNotes: values.strengthsNotes ?? "",
      weaknessesNotes: values.weaknessesNotes ?? "",
      overallNotes: values.overallNotes ?? "",
    });
    return { ok: true };
  };

  const allEvaluated = React.useMemo(() => {
    if (questions.length === 0) return false;
    return questions.every((q) => getEvalStatus(q) === "EVALUATED");
  }, [questions]);

  const canCompleteInterview = interviewStatus === "IN_PROGRESS" && Boolean(scorecard) && allEvaluated;

  const onCompleteInterview = async () => {
    if (!canCompleteInterview) return;
    setError(null);
    setNotice(null);
    setIsCompletingInterview(true);
    try {
      const result = await completeInterviewAction(interviewId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/interviews/${interviewId}`);
      router.refresh();
    } finally {
      setIsCompletingInterview(false);
    }
  };

  const onAddAdHocQuestion = adHocForm.handleSubmit(async (values) => {
    if (isReadOnly) {
      setError(readOnlyTooltip);
      return;
    }
    setError(null);
    setNotice(null);
    setIsAddingAdHoc(true);
    try {
      const result = await addAdHocInterviewQuestionAction(interviewId, values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      adHocForm.reset({ questionText: "", topic: "", difficulty: "" } as unknown as AddAdHocQuestionValues);
      setShowAdHoc(false);
      setNotice("Question added.");
      router.replace(`/interviews/${interviewId}/session?q=${encodeURIComponent(result.data.id)}`);
      router.refresh();
    } finally {
      setIsAddingAdHoc(false);
    }
  });

  const orderedQuestions = React.useMemo(() => [...questions].sort((a, b) => a.order - b.order), [questions]);
  const selectedIndex = React.useMemo(
    () => (selectedQuestion ? orderedQuestions.findIndex((q) => q.id === selectedQuestion.id) : -1),
    [orderedQuestions, selectedQuestion],
  );
  const isLastQuestion = selectedIndex !== -1 && selectedIndex === orderedQuestions.length - 1;
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex !== -1 && selectedIndex < orderedQuestions.length - 1;

  const onPrevQuestion = async () => {
    if (evaluationBusy || isSavingEvaluation) return;
    if (!selectedQuestion) return;
    if (!canGoPrev) return;
    if (isReadOnly) {
      setSelectedQuestionId(orderedQuestions[selectedIndex - 1].id);
      return;
    }
    setIsSavingEvaluation(true);
    isControlledQuestionNavigationRef.current = true;
    try {
      const saved = await saveCurrentEvaluationOrSetError();
      if (!saved.ok) return;
      showBriefNotice("Evaluation saved.");
      setSelectedQuestionId(orderedQuestions[selectedIndex - 1].id, { keepNotice: true });
      router.refresh();
    } finally {
      setIsSavingEvaluation(false);
      window.setTimeout(() => {
        isControlledQuestionNavigationRef.current = false;
      }, 0);
    }
  };

  const onNextOrFinish = async () => {
    if (evaluationBusy || isSavingEvaluation) return;
    if (!selectedQuestion) return;
    if (orderedQuestions.length === 0) return;

    if (isReadOnly) {
      if (canGoNext) setSelectedQuestionId(orderedQuestions[selectedIndex + 1].id);
      return;
    }

    setIsSavingEvaluation(true);
    isControlledQuestionNavigationRef.current = true;
    try {
      const saved = await saveCurrentEvaluationOrSetError();
      if (!saved.ok) return;

      if (isLastQuestion) {
        setError(null);
        showBriefNotice("All interview questions evaluated.");
        router.refresh();
        const el = document.getElementById("scorecard-section");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (!canGoNext) return;
      showBriefNotice("Evaluation saved.");
      setSelectedQuestionId(orderedQuestions[selectedIndex + 1].id, { keepNotice: true });
      router.refresh();
    } finally {
      setIsSavingEvaluation(false);
      window.setTimeout(() => {
        isControlledQuestionNavigationRef.current = false;
      }, 0);
    }
  };

  const onSuggestFollowUp = async () => {
    if (!selectedQuestion) return;
    if (isReadOnly) {
      setError(readOnlyTooltip);
      return;
    }
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
    if (isReadOnly) {
      setError(readOnlyTooltip);
      return;
    }
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
    if (isReadOnly) {
      setError(readOnlyTooltip);
      return;
    }
    const raw = aiInsight?.suggestedScore;
    if (typeof raw !== "number" || Number.isNaN(raw)) return;
    evaluationForm.setValue("score", raw, { shouldDirty: true });
  };

  const onSaveScorecard = scorecardForm.handleSubmit(async (values) => {
    if (isReadOnly) {
      setError(readOnlyTooltip);
      return;
    }
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
    if (isReadOnly) {
      setError(readOnlyTooltip);
      return;
    }
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

      setNotice("AI summary generated. Review and save when ready.");
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const questionTags = selectedQuestion ? tagsToList(selectedQuestion.tagsJson) : [];
  const scorecardOverall = scorecard?.overallScore ?? null;
  const communicationLiveRaw = useWatch({ control: scorecardForm.control, name: "communicationScore" });
  const problemSolvingLiveRaw = useWatch({ control: scorecardForm.control, name: "problemSolvingScore" });
  const interviewerTechLiveRaw = useWatch({ control: scorecardForm.control, name: "interviewerTechnicalAssessment" });
  const communicationLive =
    typeof communicationLiveRaw === "number" && !Number.isNaN(communicationLiveRaw) ? communicationLiveRaw : null;
  const problemSolvingLive =
    typeof problemSolvingLiveRaw === "number" && !Number.isNaN(problemSolvingLiveRaw) ? problemSolvingLiveRaw : null;
  const interviewerTechLive =
    typeof interviewerTechLiveRaw === "number" && !Number.isNaN(interviewerTechLiveRaw) ? interviewerTechLiveRaw : null;
  const liveOverall = React.useMemo(
    () =>
      computeOverallScore({
        technicalAverage: progress.technicalAverage,
        communication: communicationLive,
        problemSolving: problemSolvingLive,
        interviewerTechnicalAssessment: interviewerTechLive,
      }),
    [communicationLive, interviewerTechLive, problemSolvingLive, progress.technicalAverage],
  );
  const liveRecommendation = autoRecommendation(liveOverall);
  const recommendationToShow = liveRecommendation ?? scorecard?.recommendation ?? null;
  const overallToShow = typeof liveOverall === "number" ? liveOverall : scorecardOverall;
  const canGenerateReport =
    interviewStatus === "COMPLETED" && Boolean(scorecard) && progress.total > 0 && progress.evaluated > 0;

  return (
    <div className="space-y-6">
      {isReadOnly ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="font-medium">Interview Completed</div>
          <div className="text-emerald-800">This interview has been completed and is now available in read-only mode.</div>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Interview session</div>
          <div className="text-2xl font-semibold">{candidate.fullName}</div>
          <div className="text-sm text-muted-foreground">{jobDescription.title}</div>
        </div>
        <div className="flex items-center gap-2">
          {evaluationBusy ? (
            <Button variant="outline" disabled>
              Back to Interview Detail
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (evaluationForm.formState.isDirty) {
                  const ok = window.confirm("You have unsaved changes. Save before leaving?");
                  if (ok) return;
                }
                router.push(`/interviews/${interviewId}`);
              }}
            >
              Back to Interview Detail
            </Button>
          )}
          {latestReportId && canViewReports ? (
            <Button asChild variant="outline">
              <Link href={`/reports/${latestReportId}`}>View Report</Link>
            </Button>
          ) : null}
          {canGenerateReports && interviewStatus === "COMPLETED" ? (
            <form action={generateInterviewReportAndRedirectAction}>
              <input type="hidden" name="interviewId" value={interviewId} />
              <input type="hidden" name="type" value="FULL" />
              <input type="hidden" name="force" value={latestReportId ? "1" : "0"} />
              <input type="hidden" name="returnTo" value={`/interviews/${interviewId}/session`} />
              <FormSubmitButton disabled={!canGenerateReport} pendingText={latestReportId ? "Regenerating..." : "Generating..."}>
                {latestReportId ? "Regenerate Report" : "Generate Report"}
              </FormSubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      {canGenerateReports && interviewStatus === "COMPLETED" && !canGenerateReport ? (
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          Complete the interview with evaluated questions and a saved scorecard before generating a report.
        </div>
      ) : null}

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

              {canCompleteInterview ? (
                <Button onClick={onCompleteInterview} disabled={isCompletingInterview || evaluationBusy || isAddingAdHoc}>
                  {isCompletingInterview ? "Completing..." : "Complete Interview"}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questions</CardTitle>
              <CardDescription>Select a question to evaluate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!isReadOnly ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAdHoc((v) => !v)}
                      disabled={evaluationBusy || isAddingAdHoc}
                    >
                      Add Ad-hoc Question
                    </Button>
                  </div>

                  {showAdHoc ? (
                    <form onSubmit={onAddAdHocQuestion} className="space-y-3 rounded-md border p-3">
                      <div className="space-y-2">
                        <Label htmlFor="adHocQuestionText">Question</Label>
                        <textarea
                          id="adHocQuestionText"
                          className={cn(
                            "min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          )}
                          {...adHocForm.register("questionText")}
                        />
                        {adHocForm.formState.errors.questionText?.message ? (
                          <p className="text-sm text-destructive">
                            {String(adHocForm.formState.errors.questionText.message)}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="adHocTopic">Topic (optional)</Label>
                          <Input id="adHocTopic" {...adHocForm.register("topic")} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="adHocDifficulty">Difficulty (optional)</Label>
                          <select id="adHocDifficulty" className={selectClassName} {...adHocForm.register("difficulty")}>
                            <option value="">—</option>
                            <option value="BEGINNER">Beginner</option>
                            <option value="JUNIOR">Junior</option>
                            <option value="MID_LEVEL">Mid-level</option>
                            <option value="SENIOR">Senior</option>
                            <option value="LEAD">Lead</option>
                            <option value="HEAD_ARCHITECT">Head Architect</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="submit" disabled={isAddingAdHoc || evaluationBusy}>
                          {isAddingAdHoc ? "Adding..." : "Add Question"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowAdHoc(false)}
                          disabled={isAddingAdHoc}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </>
              ) : null}

              {questions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No interview questions yet.</div>
              ) : (
                <div className="space-y-2">
                  {questions
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((q) => {
                      const isSelected = q.id === selectedQuestion?.id;
                      const band = getScoreBand(q.evaluation?.score ?? null, 10);
                      const isWeak = band.label === "Weak" || band.label === "Invalid score";
                      const isEvaluated = band.label === "Strong" || band.label === "Average" || band.label === "Weak";
                      const rowToneClass = isWeak
                        ? "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20"
                        : isEvaluated
                          ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20"
                          : null;

                      return (
                        <button
                          key={q.id}
                          type="button"
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                            isSelected ? "border-primary" : "hover:bg-muted/40",
                            evaluationBusy || isSavingEvaluation ? "opacity-60" : null,
                            !isSelected ? rowToneClass : null,
                          )}
                          disabled={evaluationBusy || isSavingEvaluation}
                          onClick={() => setSelectedQuestionId(q.id)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">
                              {q.order}. {q.topic ?? "—"}
                            </div>
                            <QuestionScoreBadge score={q.evaluation?.score ?? null} />
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

                  <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="score">
                          Score (1–10) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="score"
                          type="number"
                          min={1}
                          max={10}
                          disabled={evaluationBusy || isReadOnly}
                          {...evaluationForm.register("score", { valueAsNumber: true })}
                        />
                        {evaluationForm.formState.errors.score?.message ? (
                          <p className="text-sm text-destructive">{String(evaluationForm.formState.errors.score.message)}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="status">
                          Status <span className="text-destructive">*</span>
                        </Label>
                        <select
                          id="status"
                          className={selectClassName}
                          disabled={evaluationBusy || isReadOnly}
                          {...evaluationForm.register("status")}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="IN_REVIEW">In Review</option>
                          <option value="EVALUATED">Evaluated</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="strengthsNotes">
                          Strengths <span className="text-destructive">*</span>
                        </Label>
                        <textarea
                          id="strengthsNotes"
                          className={cn(
                            "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          )}
                          readOnly={isReadOnly}
                          {...evaluationForm.register("strengthsNotes")}
                        />
                        {evaluationForm.formState.errors.strengthsNotes?.message ? (
                          <p className="text-sm text-destructive">
                            {String(evaluationForm.formState.errors.strengthsNotes.message)}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weaknessesNotes">
                          Weaknesses <span className="text-destructive">*</span>
                        </Label>
                        <textarea
                          id="weaknessesNotes"
                          className={cn(
                            "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          )}
                          readOnly={isReadOnly}
                          {...evaluationForm.register("weaknessesNotes")}
                        />
                        {evaluationForm.formState.errors.weaknessesNotes?.message ? (
                          <p className="text-sm text-destructive">
                            {String(evaluationForm.formState.errors.weaknessesNotes.message)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="overallNotes">
                        Overall notes/comments <span className="text-destructive">*</span>
                      </Label>
                      <textarea
                        id="overallNotes"
                        className={cn(
                          "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        )}
                        readOnly={isReadOnly}
                        {...evaluationForm.register("overallNotes")}
                      />
                      {evaluationForm.formState.errors.overallNotes?.message ? (
                        <p className="text-sm text-destructive">{String(evaluationForm.formState.errors.overallNotes.message)}</p>
                      ) : null}
                    </div>

                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onPrevQuestion}
                        disabled={evaluationBusy || isSavingEvaluation || !canGoPrev}
                      >
                        Previous Question
                      </Button>
                      <Button
                        type="button"
                        onClick={onNextOrFinish}
                        disabled={evaluationBusy || isSavingEvaluation || (!canGoNext && !isLastQuestion)}
                      >
                        {isSavingEvaluation ? "Saving..." : isLastQuestion ? "Finish Evaluation" : "Next Question"}
                      </Button>
                    </div>

                    <div className="h-px bg-border" />

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">AI assistant</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isReadOnly ? (
                            <>
                              <span title={readOnlyTooltip}>
                                <Button type="button" variant="outline" disabled>
                                  Suggest Follow-up
                                </Button>
                              </span>
                              <span title={readOnlyTooltip}>
                                <Button type="button" variant="outline" disabled>
                                  Generate AI Insight
                                </Button>
                              </span>
                            </>
                          ) : (
                            <>
                              <Button type="button" variant="outline" onClick={onSuggestFollowUp} disabled={followUpLoading}>
                                {followUpLoading ? "Generating..." : "Suggest Follow-up"}
                              </Button>
                              <Button type="button" variant="outline" onClick={onGenerateAiInsight} disabled={aiInsightLoading}>
                                {aiInsightLoading ? "Generating..." : "Generate AI Insight"}
                              </Button>
                              <Button type="button" variant="outline" onClick={onApplyAiSuggestedScore} disabled={!aiInsight}>
                                Apply Suggested Score
                              </Button>
                            </>
                          )}
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
                                  {isReadOnly ? (
                                    <span title={readOnlyTooltip}>
                                      <Button type="button" size="sm" disabled>
                                        Accept
                                      </Button>
                                    </span>
                                  ) : (
                                    <Button type="button" size="sm" onClick={() => onAcceptFollowUp(f.questionText)}>
                                      Accept
                                    </Button>
                                  )}
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

          <Card id="scorecard-section">
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
                  <div className="text-lg font-semibold">{typeof overallToShow === "number" ? overallToShow.toFixed(2) : "—"}</div>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground">Recommendation</div>
                  <div className="mt-1">
                    <RecommendationBadge value={recommendationToShow} emptyLabel="Not submitted" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isReadOnly ? (
                  <span title={readOnlyTooltip}>
                    <Button type="button" variant="outline" disabled>
                      Generate AI Summary
                    </Button>
                  </span>
                ) : (
                  <Button type="button" variant="outline" onClick={onGenerateAiSummary} disabled={aiSummaryLoading}>
                    {aiSummaryLoading ? "Generating..." : "Generate AI Summary"}
                  </Button>
                )}
              </div>

              <form onSubmit={isReadOnly ? (e) => e.preventDefault() : onSaveScorecard} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="communicationScore">
                      Communication <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="communicationScore"
                      type="number"
                      min={1}
                      max={10}
                      disabled={isReadOnly}
                      {...scorecardForm.register("communicationScore", { valueAsNumber: true })}
                    />
                    {scorecardForm.formState.errors.communicationScore?.message ? (
                      <p className="text-sm text-destructive">{String(scorecardForm.formState.errors.communicationScore.message)}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="problemSolvingScore">
                      Problem solving <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="problemSolvingScore"
                      type="number"
                      min={1}
                      max={10}
                      disabled={isReadOnly}
                      {...scorecardForm.register("problemSolvingScore", { valueAsNumber: true })}
                    />
                    {scorecardForm.formState.errors.problemSolvingScore?.message ? (
                      <p className="text-sm text-destructive">{String(scorecardForm.formState.errors.problemSolvingScore.message)}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interviewerTechnicalAssessment">
                      Interviewer Technical Assessment <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="interviewerTechnicalAssessment"
                      type="number"
                      min={1}
                      max={10}
                      disabled={isReadOnly}
                      {...scorecardForm.register("interviewerTechnicalAssessment", { valueAsNumber: true })}
                    />
                    {scorecardForm.formState.errors.interviewerTechnicalAssessment?.message ? (
                      <p className="text-sm text-destructive">
                        {String(scorecardForm.formState.errors.interviewerTechnicalAssessment.message)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Recommendation is automatically calculated from interview score.
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interviewSummary">
                    Interview summary <span className="text-destructive">*</span>
                  </Label>
                  <textarea
                    id="interviewSummary"
                    className={cn(
                      "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                    readOnly={isReadOnly}
                    {...scorecardForm.register("interviewSummary")}
                  />
                  {scorecardForm.formState.errors.interviewSummary?.message ? (
                    <p className="text-sm text-destructive">{String(scorecardForm.formState.errors.interviewSummary.message)}</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="strongAreas">
                      Strong areas <span className="text-destructive">*</span>
                    </Label>
                    <textarea
                      id="strongAreas"
                      className={cn(
                        "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      )}
                      readOnly={isReadOnly}
                      {...scorecardForm.register("strongAreas")}
                    />
                    {scorecardForm.formState.errors.strongAreas?.message ? (
                      <p className="text-sm text-destructive">{String(scorecardForm.formState.errors.strongAreas.message)}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hiringConcerns">
                      Hiring concerns <span className="text-destructive">*</span>
                    </Label>
                    <textarea
                      id="hiringConcerns"
                      className={cn(
                        "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      )}
                      readOnly={isReadOnly}
                      {...scorecardForm.register("hiringConcerns")}
                    />
                    {scorecardForm.formState.errors.hiringConcerns?.message ? (
                      <p className="text-sm text-destructive">{String(scorecardForm.formState.errors.hiringConcerns.message)}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="finalRecommendation">
                    Final recommendation notes <span className="text-destructive">*</span>
                  </Label>
                  <textarea
                    id="finalRecommendation"
                    className={cn(
                      "min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                    readOnly={isReadOnly}
                    {...scorecardForm.register("finalRecommendation")}
                  />
                  {scorecardForm.formState.errors.finalRecommendation?.message ? (
                    <p className="text-sm text-destructive">{String(scorecardForm.formState.errors.finalRecommendation.message)}</p>
                  ) : null}
                </div>

                {!isReadOnly ? (
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={scorecardForm.formState.isSubmitting}>
                      {scorecardForm.formState.isSubmitting ? "Saving..." : "Save Scorecard"}
                    </Button>
                  </div>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
