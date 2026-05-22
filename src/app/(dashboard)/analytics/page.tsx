import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleBarChart, SimpleLineChart } from "@/features/analytics/charts";
import { getAdvancedAnalyticsForOrganization, getDashboardAnalyticsForOrganization } from "@/server/services/analytics-service";
import { hasFeature } from "@/server/services/feature-flags";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

export default async function AnalyticsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canViewAnalytics = hasPermission(ctx.role, "analytics:view");
  if (!canViewAnalytics) {
    return (
      <div>
        <PageHeader title="Analytics" description="Trends and insights" />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">You do not have permission to view analytics.</CardContent>
        </Card>
      </div>
    );
  }

  const advancedAllowed = await hasFeature(ctx.organization.id, "advancedAnalytics");
  const dashboard = await getDashboardAnalyticsForOrganization(ctx.organization.id);
  const advanced = advancedAllowed ? await getAdvancedAnalyticsForOrganization(ctx.organization.id) : null;

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
                {advanced?.aiUsage.aiGeneratedPct !== null && typeof advanced?.aiUsage.aiGeneratedPct === "number"
                  ? `${advanced.aiUsage.aiGeneratedPct}%`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Follow-ups</div>
              <div className="text-lg font-semibold">{advanced?.aiUsage.followUps ?? "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!advancedAllowed ? (
              <div className="text-muted-foreground">Upgrade to TEAM to unlock advanced analytics.</div>
            ) : advanced && advanced.pipeline.length === 0 ? (
              <div className="text-muted-foreground">No interview activity yet.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {advanced?.pipeline.map((p) => (
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
            {advancedAllowed && advanced ? (
              <SimpleLineChart data={advanced.weeklyAverageScore} xKey="label" yKey="avgScore" />
            ) : (
              <div className="text-sm text-muted-foreground">Upgrade to TEAM to unlock advanced analytics.</div>
            )}
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
            {!advancedAllowed ? (
              <div className="text-muted-foreground">Upgrade to TEAM to unlock advanced analytics.</div>
            ) : advanced && advanced.strengthsKeywords.length === 0 ? (
              <div className="text-muted-foreground">No strengths notes recorded yet.</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {advanced?.strengthsKeywords.map((k) => (
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
            {!advancedAllowed ? (
              <div className="text-muted-foreground">Upgrade to TEAM to unlock advanced analytics.</div>
            ) : advanced && advanced.weaknessesKeywords.length === 0 ? (
              <div className="text-muted-foreground">No weaknesses notes recorded yet.</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {advanced?.weaknessesKeywords.map((k) => (
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
            <CardTitle>Interviewer activity (placeholder)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!advancedAllowed ? (
              <div className="text-muted-foreground">Upgrade to TEAM to unlock advanced analytics.</div>
            ) : advanced && advanced.interviewerActivity.length === 0 ? (
              <div className="text-muted-foreground">No activity yet.</div>
            ) : (
              <div className="space-y-2">
                {advanced?.interviewerActivity.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.name ?? u.email ?? u.userId}</div>
                      <div className="truncate text-muted-foreground">{u.email ?? "—"}</div>
                    </div>
                    <div className="text-right text-muted-foreground">
                      {u.completed}/{u.interviews}
                    </div>
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
