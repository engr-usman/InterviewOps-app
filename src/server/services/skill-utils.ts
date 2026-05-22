import type { Prisma } from "@prisma/client";

export function slugifySkillName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export async function upsertSkillsByName(
  tx: Prisma.TransactionClient,
  names: string[],
): Promise<Array<{ id: string; name: string; slug: string }>> {
  const normalized = uniqueStrings(names).slice(0, 100);
  if (normalized.length === 0) return [];

  const slugs = normalized.map((n) => slugifySkillName(n));

  const existing = await tx.skill.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, name: true, slug: true },
  });

  const existingBySlug = new Map(existing.map((s) => [s.slug, s]));
  const toCreate = normalized
    .map((name, i) => ({ name, slug: slugs[i] }))
    .filter((s) => s.slug && !existingBySlug.has(s.slug));

  if (toCreate.length > 0) {
    await tx.skill.createMany({
      data: toCreate.map((s) => ({ name: s.name, slug: s.slug })),
      skipDuplicates: true,
    });
  }

  const all = await tx.skill.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, name: true, slug: true },
  });

  return all;
}

