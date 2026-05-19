import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";

export default async function HomePage() {
  const session = await getServerAuthSession();
  redirect(session ? "/dashboard" : "/login");
}
