"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { getScoreBand } from "@/features/interviews/score-band";

export function QuestionScoreBadge({
  score,
  maxScore = 10,
  showLabel = true,
  className,
}: {
  score?: number | null;
  maxScore?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const band = getScoreBand(score, maxScore);
  const labelText =
    band.label === "Pending" || band.label === "Invalid score"
      ? band.label
      : `${score}/${maxScore}${showLabel ? ` ${band.label}` : ""}`;
  const pendingOrInvalidText = band.label === "Pending" || band.label === "Invalid score";
  const text = pendingOrInvalidText ? (showLabel ? band.label : band.label) : labelText;

  const toneClass =
    band.tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      : band.tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : band.tone === "red"
          ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        toneClass,
        className,
      )}
      aria-label={text}
      title={text}
    >
      {pendingOrInvalidText ? band.label : showLabel ? `${score}/${maxScore} ${band.label}` : `${score}/${maxScore}`}
    </span>
  );
}

