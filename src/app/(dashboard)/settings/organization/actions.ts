"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrgContextOrThrow } from "@/server/services/org-context";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const updateOrgSchema = z.object({
  name: z.string().trim().min(2).max(80),
  website: z
    .string()
    .trim()
    .max(200)
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
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function updateOrganizationProfileAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };

  const ctx = await getOrgContextOrThrow(session.user.id);
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") return { ok: false, error: "Insufficient permissions." };

  const parsed = updateOrgSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid organization details." };

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
