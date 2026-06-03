import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = await getServerAuthSession();
  const params = (await searchParams) ?? {};
  const callbackUrl = typeof params.callbackUrl === "string" && params.callbackUrl.trim() ? params.callbackUrl : "/dashboard";
  if (session) redirect(callbackUrl);
  return <LoginForm />;
}
