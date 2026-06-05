import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getOrgContextOrNull, listUserOrganizations } from "@/server/services/org-context";
import { OnboardingPanel } from "@/features/orgs/onboarding-panel";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const params = (await searchParams) ?? {};
  const requestedMode = params.mode === "create" ? "create" : "default";

  const ctx = await getOrgContextOrNull(session.user.id);
  const orgs = await listUserOrganizations(session.user.id);
  const canCreateOrganization = ctx?.role === "OWNER";
  const mode = canCreateOrganization ? requestedMode : "default";

  return (
    <div className="space-y-6">
      <PageHeader title="Onboarding" description="Set up your organization to start using InterviewOps." />
      <OnboardingPanel organizations={orgs} initialMode={mode} canCreateOrganization={canCreateOrganization} />
    </div>
  );
}
