import { PageHeader } from "@/components/layout/page-header";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { SettingsForm } from "@/features/settings/settings-form";
import { getBooleanSetting, getNumberSetting, getStringSetting } from "@/server/services/app-settings";

export default async function SettingsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const [aiProvider, apiKey, resumeParsingEnabled, jdAnalysisEnabled, maxResumeBytes] = await Promise.all([
    getStringSetting("ai.provider", "mock"),
    getStringSetting("ai.apiKey", ""),
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
          aiProvider: aiProvider === "openai" || aiProvider === "gemini" || aiProvider === "claude" ? aiProvider : "mock",
          apiKey,
          resumeParsingEnabled,
          jdAnalysisEnabled,
          maxResumeUploadMb,
        }}
      />
    </div>
  );
}
