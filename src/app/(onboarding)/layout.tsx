import * as React from "react";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  return <div className="mx-auto w-full max-w-3xl p-6">{children}</div>;
}

