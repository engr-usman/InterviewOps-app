import { InterviewStatus, QuestionType, Recommendation, RequirementType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type Db = {
  candidate: { count: (args: unknown) => Promise<number> };
  interview: {
    groupBy: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown>;
  };
  evaluationScorecard: {
    aggregate: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown>;
    groupBy: (args: unknown) => Promise<unknown>;
  };
  interviewQuestion: {
    count: (args: unknown) => Promise<number>;
    groupBy: (args: unknown) => Promise<unknown>;
  };
  jobDescriptionSkillRequirement: { findMany: (args: unknown) => Promise<unknown> };
  interviewQuestionEvaluation: { findMany: (args: unknown) => Promise<unknown> };
  user: { findMany: (args: unknown) => Promise<Array<{ id: string; name: string | null; email: string | null }>> };
};

const db = prisma as unknown as Db;

export type DashboardKpis = {
  totalCandidates: number;
  totalInterviews: number;
  completedInterviews: number;
  activeInterviews: number;
  averageCandidateScore: number | null;
  hireRecommendationRatePct: number | null;
  aiGeneratedQuestionUsagePct: number | null;
  topSkillsEvaluated: Array<{ skill: string; count: number }>;
};

export type InterviewTrendPoint = {
  label: string;
  interviews: number;
  completed: number;
};

export type ScoreBucketPoint = {
  bucket: string;
  count: number;
};

export type RecommendationPoint = {
  recommendation: string;
  count: number;
};

export type DifficultyUsagePoint = {
  difficulty: string;
  fixed: number;
  aiGenerated: number;
  followUp: number;
};

export type SkillDemandPoint = {
  skill: string;
  required: number;
  preferred: number;
};

export type DashboardAnalytics = {
  kpis: DashboardKpis;
  interviewTrend: InterviewTrendPoint[];
  scoreDistribution: ScoreBucketPoint[];
  recommendationBreakdown: RecommendationPoint[];
  difficultyUsage: DifficultyUsagePoint[];
  skillDemand: SkillDemandPoint[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // convert to Monday-based
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(d);
}

function tokenizeNotes(text: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "with",
    "that",
    "this",
    "from",
    "have",
    "has",
    "had",
    "were",
    "was",
    "are",
    "for",
    "but",
    "not",
    "they",
    "them",
    "their",
    "then",
    "than",
    "into",
    "over",
    "when",
    "what",
    "why",
    "how",
    "can",
    "could",
    "should",
    "would",
    "very",
    "more",
    "most",
    "some",
    "also",
    "able",
    "good",
    "great",
    "nice",
    "lack",
  ]);

  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !stop.has(t));
}

export type AdvancedAnalytics = {
  pipeline: Array<{ status: string; count: number }>;
  strengthsKeywords: Array<{ keyword: string; count: number }>;
  weaknessesKeywords: Array<{ keyword: string; count: number }>;
  weeklyAverageScore: Array<{ label: string; avgScore: number }>;
  interviewerActivity: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    interviews: number;
    completed: number;
  }>;
  aiUsage: {
    aiGeneratedQuestions: number;
    followUps: number;
    aiGeneratedPct: number | null;
  };
};

export async function getDashboardAnalyticsForOrganization(organizationId: string): Promise<DashboardAnalytics> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7 * 12);
  start.setHours(0, 0, 0, 0);

  const [
    totalCandidates,
    interviewStatusCountsRaw,
    avgOverallAggRaw,
    scorecardCountsRaw,
    aiQuestionsCount,
    totalQuestionsCount,
    interviewsForTrendRaw,
    overallScoresRaw,
    recommendationCountsRaw,
    difficultyTypeCountsRaw,
    jdSkillReqsRaw,
  ] = await Promise.all([
    db.candidate.count({ where: { organizationId } }),
    db.interview.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    db.evaluationScorecard.aggregate({
      where: { interview: { organizationId }, overallScore: { not: null } },
      _avg: { overallScore: true },
    }),
    db.evaluationScorecard.aggregate({
      where: { interview: { organizationId }, recommendation: { not: null } },
      _count: { _all: true },
    }),
    db.interviewQuestion.count({
      where: { interview: { organizationId }, type: QuestionType.AI_GENERATED },
    }),
    db.interviewQuestion.count({
      where: { interview: { organizationId } },
    }),
    db.interview.findMany({
      where: { organizationId, createdAt: { gte: start } },
      select: { createdAt: true, status: true },
      take: 2000,
      orderBy: { createdAt: "asc" },
    }),
    db.evaluationScorecard.findMany({
      where: { interview: { organizationId }, overallScore: { not: null } },
      select: { overallScore: true },
      take: 2000,
      orderBy: { createdAt: "desc" },
    }),
    db.evaluationScorecard.groupBy({
      by: ["recommendation"],
      where: { interview: { organizationId }, recommendation: { not: null } },
      _count: { _all: true },
    }),
    db.interviewQuestion.groupBy({
      by: ["difficulty", "type"],
      where: { interview: { organizationId } },
      _count: { _all: true },
    }),
    db.jobDescriptionSkillRequirement.findMany({
      where: {
        jobDescription: { organizationId },
        requirementType: { in: [RequirementType.REQUIRED, RequirementType.PREFERRED] },
      },
      select: { requirementType: true, skill: { select: { name: true } } },
      take: 5000,
    }),
  ]);

  const interviewStatusCounts = interviewStatusCountsRaw as Array<{
    status: InterviewStatus;
    _count: { _all: number };
  }>;
  const avgOverallAgg = avgOverallAggRaw as { _avg: { overallScore: number | null } };
  const scorecardCounts = scorecardCountsRaw as { _count: { _all: number } };
  const interviewsForTrend = interviewsForTrendRaw as Array<{ createdAt: Date; status: InterviewStatus }>;
  const overallScores = overallScoresRaw as Array<{ overallScore: number | null }>;
  const recommendationCounts = recommendationCountsRaw as Array<{
    recommendation: Recommendation | null;
    _count: { _all: number };
  }>;
  const difficultyTypeCounts = difficultyTypeCountsRaw as Array<{
    difficulty: unknown;
    type: QuestionType;
    _count: { _all: number };
  }>;
  const jdSkillReqs = jdSkillReqsRaw as Array<{
    requirementType: RequirementType;
    skill: { name: string };
  }>;

  const statusMap = new Map<InterviewStatus, number>(interviewStatusCounts.map((r) => [r.status, r._count._all]));
  const totalInterviews = Array.from(statusMap.values()).reduce((a, b) => a + b, 0);
  const completedInterviews = statusMap.get(InterviewStatus.COMPLETED) ?? 0;
  const activeInterviews = (statusMap.get(InterviewStatus.IN_PROGRESS) ?? 0) + (statusMap.get(InterviewStatus.SCHEDULED) ?? 0);

  const averageCandidateScore = typeof avgOverallAgg._avg.overallScore === "number" ? round2(avgOverallAgg._avg.overallScore) : null;

  const hireCount = recommendationCounts
    .filter((r) => r.recommendation === Recommendation.STRONG_HIRE || r.recommendation === Recommendation.HIRE)
    .reduce((sum, r) => sum + r._count._all, 0);
  const recTotal = scorecardCounts._count._all;
  const hireRecommendationRatePct = recTotal === 0 ? null : Math.round((hireCount / recTotal) * 100);

  const aiGeneratedQuestionUsagePct = totalQuestionsCount === 0 ? null : Math.round((aiQuestionsCount / totalQuestionsCount) * 100);

  const interviewTrendMap = new Map<number, { week: Date; interviews: number; completed: number }>();
  for (const i of interviewsForTrend) {
    const weekStart = startOfWeek(i.createdAt);
    const key = weekStart.getTime();
    const current = interviewTrendMap.get(key) ?? { week: weekStart, interviews: 0, completed: 0 };
    current.interviews += 1;
    if (i.status === InterviewStatus.COMPLETED) current.completed += 1;
    interviewTrendMap.set(key, current);
  }
  const interviewTrend = Array.from(interviewTrendMap.values())
    .sort((a, b) => a.week.getTime() - b.week.getTime())
    .slice(-12)
    .map((p) => ({ label: formatShortDate(p.week), interviews: p.interviews, completed: p.completed }));

  const scoreDistribution: ScoreBucketPoint[] = Array.from({ length: 10 }, (_, i) => ({
    bucket: `${i + 1}`,
    count: 0,
  }));
  for (const row of overallScores) {
    const s = row.overallScore;
    if (typeof s !== "number") continue;
    const clamped = Math.min(10, Math.max(1, s));
    const idx = Math.min(9, Math.max(0, Math.floor(clamped - 1)));
    scoreDistribution[idx].count += 1;
  }

  const recommendationBreakdown: RecommendationPoint[] = recommendationCounts
    .filter((r) => r.recommendation)
    .map((r) => ({ recommendation: String(r.recommendation), count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  const difficultyMap = new Map<string, DifficultyUsagePoint>();
  for (const row of difficultyTypeCounts) {
    const diff = String(row.difficulty);
    const current =
      difficultyMap.get(diff) ?? { difficulty: diff, fixed: 0, aiGenerated: 0, followUp: 0 };
    if (row.type === QuestionType.FIXED) current.fixed += row._count._all;
    if (row.type === QuestionType.AI_GENERATED) current.aiGenerated += row._count._all;
    if (row.type === QuestionType.FOLLOW_UP) current.followUp += row._count._all;
    difficultyMap.set(diff, current);
  }
  const difficultyUsage = Array.from(difficultyMap.values()).sort((a, b) => a.difficulty.localeCompare(b.difficulty));

  const skillDemandMap = new Map<string, SkillDemandPoint>();
  for (const r of jdSkillReqs) {
    const name = r.skill.name;
    const current = skillDemandMap.get(name) ?? { skill: name, required: 0, preferred: 0 };
    if (r.requirementType === RequirementType.REQUIRED) current.required += 1;
    if (r.requirementType === RequirementType.PREFERRED) current.preferred += 1;
    skillDemandMap.set(name, current);
  }
  const skillDemand = Array.from(skillDemandMap.values())
    .sort((a, b) => b.required + b.preferred - (a.required + a.preferred))
    .slice(0, 12);

  const topSkillsEvaluated = skillDemand
    .map((s) => ({ skill: s.skill, count: s.required + s.preferred }))
    .slice(0, 8);

  return {
    kpis: {
      totalCandidates,
      totalInterviews,
      completedInterviews,
      activeInterviews,
      averageCandidateScore,
      hireRecommendationRatePct,
      aiGeneratedQuestionUsagePct,
      topSkillsEvaluated,
    },
    interviewTrend,
    scoreDistribution,
    recommendationBreakdown,
    difficultyUsage,
    skillDemand,
  };
}

export async function getAdvancedAnalyticsForOrganization(organizationId: string): Promise<AdvancedAnalytics> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7 * 12);
  start.setHours(0, 0, 0, 0);

  const [pipelineCountsRaw, evalNotesRaw, scorecardsRaw, aiCountsRaw, creatorStatusCountsRaw] = await Promise.all([
    db.interview.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    db.interviewQuestionEvaluation.findMany({
      where: { interviewQuestion: { interview: { organizationId } } },
      select: { notesText: true, metadataJson: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    db.evaluationScorecard.findMany({
      where: { interview: { organizationId }, overallScore: { not: null }, createdAt: { gte: start } },
      select: { createdAt: true, overallScore: true },
      take: 2000,
      orderBy: { createdAt: "asc" },
    }),
    db.interviewQuestion.groupBy({
      by: ["type"],
      where: { interview: { organizationId } },
      _count: { _all: true },
    }),
    db.interview.groupBy({
      by: ["createdById", "status"],
      where: { organizationId },
      _count: { _all: true },
    }),
  ]);

  const pipelineCounts = pipelineCountsRaw as Array<{ status: InterviewStatus; _count: { _all: number } }>;
  const evalNotes = evalNotesRaw as Array<{ notesText: string | null; metadataJson: unknown | null }>;
  const scorecards = scorecardsRaw as Array<{ createdAt: Date; overallScore: number | null }>;
  const aiCounts = aiCountsRaw as Array<{ type: QuestionType; _count: { _all: number } }>;
  const creatorStatusCounts = creatorStatusCountsRaw as Array<{
    createdById: string;
    status: InterviewStatus;
    _count: { _all: number };
  }>;

  const pipeline = pipelineCounts.map((p) => ({ status: String(p.status), count: p._count._all }));

  const strengths = new Map<string, number>();
  const weaknesses = new Map<string, number>();

  for (const row of evalNotes) {
    const meta = row.metadataJson as { strengthsNotes?: unknown; weaknessesNotes?: unknown } | null;
    const s = typeof meta?.strengthsNotes === "string" ? meta.strengthsNotes : "";
    const w = typeof meta?.weaknessesNotes === "string" ? meta.weaknessesNotes : "";
    for (const tok of tokenizeNotes(s)) strengths.set(tok, (strengths.get(tok) ?? 0) + 1);
    for (const tok of tokenizeNotes(w)) weaknesses.set(tok, (weaknesses.get(tok) ?? 0) + 1);
    if (typeof row.notesText === "string") {
      for (const tok of tokenizeNotes(row.notesText)) weaknesses.set(tok, (weaknesses.get(tok) ?? 0) + 1);
    }
  }

  const strengthsKeywords = Array.from(strengths.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([keyword, count]) => ({ keyword, count }));

  const weaknessesKeywords = Array.from(weaknesses.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([keyword, count]) => ({ keyword, count }));

  const weekMap = new Map<number, { week: Date; sum: number; count: number }>();
  for (const s of scorecards) {
    const week = startOfWeek(s.createdAt);
    const key = week.getTime();
    const cur = weekMap.get(key) ?? { week, sum: 0, count: 0 };
    cur.sum += s.overallScore ?? 0;
    cur.count += 1;
    weekMap.set(key, cur);
  }
  const weeklyAverageScore = Array.from(weekMap.values())
    .sort((a, b) => a.week.getTime() - b.week.getTime())
    .slice(-12)
    .map((w) => ({ label: formatShortDate(w.week), avgScore: round2(w.sum / Math.max(1, w.count)) }));

  const totalQuestions = aiCounts.reduce((sum, r) => sum + r._count._all, 0);
  const aiGeneratedQuestions = aiCounts.find((r) => r.type === QuestionType.AI_GENERATED)?._count._all ?? 0;
  const followUps = aiCounts.find((r) => r.type === QuestionType.FOLLOW_UP)?._count._all ?? 0;
  const aiGeneratedPct = totalQuestions === 0 ? null : Math.round((aiGeneratedQuestions / totalQuestions) * 100);

  const creatorIds = Array.from(new Set(creatorStatusCounts.map((r) => r.createdById)));
  const users: Array<{ id: string; name: string | null; email: string | null }> = creatorIds.length
    ? await db.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const activityMap = new Map<
    string,
    { userId: string; name: string | null; email: string | null; interviews: number; completed: number }
  >();
  for (const row of creatorStatusCounts) {
    const base = activityMap.get(row.createdById) ?? {
      userId: row.createdById,
      name: userById.get(row.createdById)?.name ?? null,
      email: userById.get(row.createdById)?.email ?? null,
      interviews: 0,
      completed: 0,
    };
    base.interviews += row._count._all;
    if (row.status === InterviewStatus.COMPLETED) base.completed += row._count._all;
    activityMap.set(row.createdById, base);
  }
  const interviewerActivity = Array.from(activityMap.values())
    .sort((a, b) => b.completed - a.completed || b.interviews - a.interviews)
    .slice(0, 10);

  return {
    pipeline,
    strengthsKeywords,
    weaknessesKeywords,
    weeklyAverageScore,
    interviewerActivity,
    aiUsage: { aiGeneratedQuestions, followUps, aiGeneratedPct },
  };
}
