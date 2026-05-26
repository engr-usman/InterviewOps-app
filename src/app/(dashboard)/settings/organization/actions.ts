"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrThrow } from "@/server/services/org-context";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Partial<Record<"name" | "website" | "industry" | "companySize" | "logoUrl", string>> };

const updateOrgSchema = z.object({
  name: z.string().trim().min(2).max(80),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v.length === 0 || /^https?:\/\//i.test(v), "Website must start with http:// or https://")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  industry: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  companySize: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  logoUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v.length === 0 || /^https?:\/\//i.test(v), "Logo URL must start with http:// or https://")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function updateOrganizationProfileAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await getOrgContextOrThrow(session.user.id);
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") return { ok: false, error: "Insufficient permissions." };

  const parsed = updateOrgSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<"name" | "website" | "industry" | "companySize" | "logoUrl", string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "name" || key === "website" || key === "industry" || key === "companySize" || key === "logoUrl") {
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
    }
    const firstMessage = parsed.error.issues[0]?.message ?? "Invalid organization details.";
    return { ok: false, error: firstMessage, fieldErrors };
  }

  const updated = await prisma.organization.update({
    where: { id: ctx.organization.id },
    data: {
      name: parsed.data.name,
      website: parsed.data.website ?? null,
      industry: parsed.data.industry ?? null,
      companySize: parsed.data.companySize ?? null,
      logoUrl: parsed.data.logoUrl ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/settings/organization");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: updated.id } };
}
