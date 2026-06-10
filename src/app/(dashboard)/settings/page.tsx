import { PageHeader } from "@/components/layout/page-header";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsNav } from "@/features/settings/settings-nav";
import { getSettingsNavItems } from "@/features/settings/settings-nav-items";
import { SettingsForm } from "@/features/settings/settings-form";
import { getBooleanSetting, getNumberSetting, getStringSetting } from "@/server/services/app-settings";
import { getOrgContextOrThrow } from "@/server/services/org-context";
import { hasPermission } from "@/server/services/rbac";

export default async function SettingsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const ctx = await getOrgContextOrThrow(session.user.id);
  const canManageSettings = hasPermission(ctx.role, "settings:manage") || hasPermission(ctx.role, "org:manage");
  const navItems = getSettingsNavItems(ctx.role);

  if (!canManageSettings) {
    return (
      <div>
        <PageHeader title="Settings" description="Application configuration" />
        <SettingsNav items={navItems} />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have permission to manage settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [
    aiEnabled,
    aiProvider,
    aiQuestionsEnabled,
    aiEvaluationEnabled,
    resumeParsingEnabled,
    aiResumeParsingEnabled,
    resumeFallbackParserEnabled,
    jdAnalysisEnabled,
    maxResumeBytes,
  ] = await Promise.all([
    getBooleanSetting("ai.enabled", false),
    getStringSetting("ai.provider", "mock"),
    getBooleanSetting("ai.questions.enabled", false),
    getBooleanSetting("ai.evaluation.enabled", false),
    getBooleanSetting("resumeParsing.enabled", true),
    getBooleanSetting("resumeParsing.aiResumeParser.enabled", false),
    getBooleanSetting("resumeParsing.fallbackParser.enabled", true),
    getBooleanSetting("jdAnalysis.enabled", true),
    getNumberSetting("uploads.maxResumeBytes", 5 * 1024 * 1024),
  ]);

  const maxResumeUploadMb = Math.max(1, Math.round(maxResumeBytes / (1024 * 1024)));

  return (
    <div>
      <PageHeader title="Settings" description="Application configuration" />
      <SettingsNav items={navItems} />

      <SettingsForm
        initialValues={{
          aiEnabled,
          aiProvider: aiProvider === "openai" || aiProvider === "gemini" || aiProvider === "claude" ? aiProvider : "mock",
          openaiApiKey: "",
          geminiApiKey: "",
          aiGeneratedQuestionsEnabled: aiQuestionsEnabled,
          aiEvaluationSuggestionsEnabled: aiEvaluationEnabled,
          resumeParsingEnabled,
          aiResumeParsingEnabled,
          resumeFallbackParserEnabled,
          jdAnalysisEnabled,
          maxResumeUploadMb,
        }}
      />
    </div>
  );
}
