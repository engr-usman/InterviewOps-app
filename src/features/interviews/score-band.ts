export type ScoreTone = "gray" | "red" | "amber" | "green";
export type ScoreBandLabel = "Pending" | "Weak" | "Average" | "Strong" | "Invalid score";

export function getScoreBand(
  score: number | null | undefined,
  maxScore: number,
): { label: ScoreBandLabel; tone: ScoreTone } {
  if (score === null || score === undefined) return { label: "Pending", tone: "gray" };
  if (typeof score !== "number" || !Number.isFinite(score)) return { label: "Invalid score", tone: "red" };
  if (!Number.isFinite(maxScore) || maxScore <= 0) return { label: "Invalid score", tone: "red" };
  if (score < 1 || score > maxScore) return { label: "Invalid score", tone: "red" };

  if (score >= 8) return { label: "Strong", tone: "green" };
  if (score >= 5) return { label: "Average", tone: "amber" };
  return { label: "Weak", tone: "red" };
}

