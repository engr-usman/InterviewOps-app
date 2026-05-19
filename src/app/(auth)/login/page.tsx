import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await getServerAuthSession();
  if (session) redirect("/dashboard");
  return <LoginForm />;
}
