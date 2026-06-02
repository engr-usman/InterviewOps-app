import type { Recommendation } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function labelForRecommendation(value: Recommendation | null): string {
  if (!value) return "—";
  if (value === "STRONG_HIRE") return "Strong Hire";
  if (value === "HIRE") return "Hire";
  if (value === "BORDERLINE") return "Borderline";
  if (value === "NO_HIRE") return "No Hire";
  if (value === "STRONG_NO_HIRE") return "Strong No Hire";
  return String(value);
}

function classNameForRecommendation(value: Recommendation | null): string {
  if (!value) {
    return "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200";
  }
  if (value === "STRONG_HIRE") {
    return "border-emerald-900 bg-emerald-950 text-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100";
  }
  if (value === "HIRE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (value === "BORDERLINE") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  return "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200";
}

export function RecommendationBadge({
  value,
  className,
  emptyLabel,
}: {
  value: Recommendation | null;
  className?: string;
  emptyLabel?: string;
}) {
  return (
    <Badge className={cn(classNameForRecommendation(value), className)} variant="outline">
      {value ? labelForRecommendation(value) : (emptyLabel ?? "—")}
    </Badge>
  );
}

