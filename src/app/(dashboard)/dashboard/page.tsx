import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { SimpleBarChart, SimpleMultiLineChart, SimplePieChart, SimpleStackedBarChart } from "@/features/analytics/charts";
import { getDashboardAnalyticsForUser } from "@/server/services/analytics-service";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const analytics = await getDashboardAnalyticsForUser(session.user.id);
  const k = analytics.kpis;

  return (
    <div>
      <PageHeader title="Dashboard" description="Hiring intelligence overview for your workspace." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{k.totalCandidates}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{k.totalInterviews}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed Interviews</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{k.completedInterviews}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Interviews</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{k.activeInterviews}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Candidate Score</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{k.averageCandidateScore ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hire Recommendation Rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{k.hireRecommendationRatePct !== null ? `${k.hireRecommendationRatePct}%` : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">AI-generated Question Usage</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {k.aiGeneratedQuestionUsagePct !== null ? `${k.aiGeneratedQuestionUsagePct}%` : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Skills (Demand)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {k.topSkillsEvaluated.length === 0 ? "—" : k.topSkillsEvaluated.slice(0, 5).map((s) => s.skill).join(", ")}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Interview trend (12 weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleMultiLineChart
              data={analytics.interviewTrend}
              xKey="label"
              lines={[
                { key: "interviews", color: "hsl(var(--primary))" },
                { key: "completed", color: "hsl(var(--muted-foreground))" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendation breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart data={analytics.recommendationBreakdown} nameKey="recommendation" valueKey="count" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate score distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={analytics.scoreDistribution} xKey="bucket" yKey="count" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Question difficulty usage</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleStackedBarChart
              data={analytics.difficultyUsage}
              xKey="difficulty"
              stacks={[
                { key: "fixed", color: "hsl(var(--primary))" },
                { key: "aiGenerated", color: "hsl(var(--secondary))" },
                { key: "followUp", color: "hsl(var(--muted-foreground))" },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
