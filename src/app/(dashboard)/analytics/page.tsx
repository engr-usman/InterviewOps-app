import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleBarChart, SimpleLineChart } from "@/features/analytics/charts";
import { getAdvancedAnalyticsForUser, getDashboardAnalyticsForUser } from "@/server/services/analytics-service";

export default async function AnalyticsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const [dashboard, advanced] = await Promise.all([
    getDashboardAnalyticsForUser(session.user.id),
    getAdvancedAnalyticsForUser(session.user.id),
  ]);

  return (
    <div>
      <PageHeader title="Analytics" description="Trends and insights" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hiring insights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Average candidate score</div>
              <div className="text-lg font-semibold">{dashboard.kpis.averageCandidateScore ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Hire recommendation rate</div>
              <div className="text-lg font-semibold">
                {dashboard.kpis.hireRecommendationRatePct !== null ? `${dashboard.kpis.hireRecommendationRatePct}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">AI-generated questions</div>
              <div className="text-lg font-semibold">
                {advanced.aiUsage.aiGeneratedPct !== null ? `${advanced.aiUsage.aiGeneratedPct}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Follow-ups</div>
              <div className="text-lg font-semibold">{advanced.aiUsage.followUps}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {advanced.pipeline.length === 0 ? (
              <div className="text-muted-foreground">No interview activity yet.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {advanced.pipeline.map((p) => (
                  <div key={p.status} className="rounded-md border p-3">
                    <div className="text-muted-foreground">{p.status}</div>
                    <div className="text-lg font-semibold">{p.count}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evaluation trends</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart data={advanced.weeklyAverageScore} xKey="label" yKey="avgScore" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skill demand analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={dashboard.skillDemand.map((s) => ({ skill: s.skill, count: s.required + s.preferred }))} xKey="skill" yKey="count" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most common strengths</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {advanced.strengthsKeywords.length === 0 ? (
              <div className="text-muted-foreground">No strengths notes recorded yet.</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {advanced.strengthsKeywords.map((k) => (
                  <div key={k.keyword} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="font-medium">{k.keyword}</div>
                    <div className="text-muted-foreground">{k.count}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most common weaknesses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {advanced.weaknessesKeywords.length === 0 ? (
              <div className="text-muted-foreground">No weaknesses notes recorded yet.</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {advanced.weaknessesKeywords.map((k) => (
                  <div key={k.keyword} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="font-medium">{k.keyword}</div>
                    <div className="text-muted-foreground">{k.count}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
