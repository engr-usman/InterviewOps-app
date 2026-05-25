import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getActiveOrganizationId, listUserOrganizations } from "@/server/services/org-context";
import { OnboardingPanel } from "@/features/orgs/onboarding-panel";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const params = (await searchParams) ?? {};
  const mode = params.mode === "create" ? "create" : "default";

  const activeOrgId = await getActiveOrganizationId(session.user.id);
  if (activeOrgId && mode !== "create") redirect("/dashboard");

  const orgs = await listUserOrganizations(session.user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Onboarding" description="Set up your organization to start using InterviewOps." />
      <OnboardingPanel organizations={orgs} initialMode={mode} />
    </div>
  );
}
