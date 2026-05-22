import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getActiveOrganizationId, listUserOrganizations } from "@/server/services/org-context";
import { OnboardingPanel } from "@/features/orgs/onboarding-panel";

export default async function OnboardingPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const activeOrgId = await getActiveOrganizationId(session.user.id);
  if (activeOrgId) redirect("/dashboard");

  const orgs = await listUserOrganizations(session.user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Onboarding" description="Set up your organization to start using InterviewOps." />
      <OnboardingPanel organizations={orgs} />
    </div>
  );
}

