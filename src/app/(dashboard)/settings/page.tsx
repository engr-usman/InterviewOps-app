import { PageHeader } from "@/components/layout/page-header";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { SettingsForm } from "@/features/settings/settings-form";
import { getBooleanSetting, getNumberSetting, getStringSetting } from "@/server/services/app-settings";

export default async function SettingsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const [aiEnabled, aiProvider, aiQuestionsEnabled, aiEvaluationEnabled, resumeParsingEnabled, jdAnalysisEnabled, maxResumeBytes] =
    await Promise.all([
      getBooleanSetting("ai.enabled", false),
    getStringSetting("ai.provider", "mock"),
      getBooleanSetting("ai.questions.enabled", false),
      getBooleanSetting("ai.evaluation.enabled", false),
    getBooleanSetting("resumeParsing.enabled", true),
    getBooleanSetting("jdAnalysis.enabled", true),
    getNumberSetting("uploads.maxResumeBytes", 5 * 1024 * 1024),
  ]);

  const maxResumeUploadMb = Math.max(1, Math.round(maxResumeBytes / (1024 * 1024)));

  return (
    <div>
      <PageHeader title="Settings" description="Application configuration" />
      <SettingsForm
        initialValues={{
          aiEnabled,
          aiProvider: aiProvider === "openai" || aiProvider === "gemini" || aiProvider === "claude" ? aiProvider : "mock",
          openaiApiKey: "",
          geminiApiKey: "",
          aiGeneratedQuestionsEnabled: aiQuestionsEnabled,
          aiEvaluationSuggestionsEnabled: aiEvaluationEnabled,
          resumeParsingEnabled,
          jdAnalysisEnabled,
          maxResumeUploadMb,
        }}
      />
    </div>
  );
}
