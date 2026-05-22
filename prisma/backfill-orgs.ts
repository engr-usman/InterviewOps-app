import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const db = prisma as unknown as {
  user: {
    findMany: (args: unknown) => Promise<Array<{ id: string; email: string; activeOrganizationId: string | null }>>;
    update: (args: unknown) => Promise<unknown>;
  };
  organization: {
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
    create: (args: unknown) => Promise<{ id: string }>;
  };
  organizationMember: {
    findMany: (args: unknown) => Promise<Array<{ organizationId: string }>>;
  };
  subscriptionPlan: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
  };
  subscription: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
    create: (args: unknown) => Promise<{ id: string }>;
  };
  candidate: {
    updateMany: (args: unknown) => Promise<unknown>;
  };
  jobDescription: {
    updateMany: (args: unknown) => Promise<unknown>;
  };
  interview: {
    updateMany: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<Array<{ id: string }>>;
  };
  report: {
    updateMany: (args: unknown) => Promise<unknown>;
  };
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function ensurePlans() {
  const plans = [
    { code: "FREE", name: "Free", priceMonthlyCents: 0 },
    { code: "PRO", name: "Pro", priceMonthlyCents: 4900 },
    { code: "TEAM", name: "Team", priceMonthlyCents: 14900 },
    { code: "ENTERPRISE", name: "Enterprise", priceMonthlyCents: null },
  ] as const;

  for (const p of plans) {
    await db.subscriptionPlan.upsert({
      where: { code: p.code },
      update: { name: p.name, priceMonthlyCents: p.priceMonthlyCents },
      create: { code: p.code, name: p.name, priceMonthlyCents: p.priceMonthlyCents },
    });
  }
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const attempt = slugify(base) || "org";
  const existing = await db.organization.findUnique({ where: { slug: attempt }, select: { id: true } });
  if (!existing) return attempt;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${attempt}-${suffix}`.slice(0, 60);
}

async function main() {
  await ensurePlans();
  const freePlan = await db.subscriptionPlan.findUnique({ where: { code: "FREE" }, select: { id: true } });
  if (!freePlan) throw new Error("FREE plan missing.");

  const users: Array<{ id: string; email: string; activeOrganizationId: string | null }> = await db.user.findMany({
    select: { id: true, email: true, activeOrganizationId: true },
    take: 5000,
    orderBy: { createdAt: "asc" },
  });

  for (const user of users) {
    const memberships: Array<{ organizationId: string }> = await db.organizationMember.findMany({
      where: { userId: user.id },
      select: { organizationId: true },
      take: 5,
      orderBy: { createdAt: "asc" },
    });

    let orgId: string | null = user.activeOrganizationId ?? null;

    if (!orgId) {
      if (memberships.length === 1) {
        orgId = memberships[0].organizationId;
        await db.user.update({ where: { id: user.id }, data: { activeOrganizationId: orgId } });
      }
    }

    if (!orgId && memberships.length === 0) {
      const local = user.email.split("@")[0] || "personal";
      const orgName = `${local} Organization`;
      const slug = await ensureUniqueSlug(local);

      const created = await db.organization.create({
        data: {
          name: orgName,
          slug,
          createdById: user.id,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
              joinedAt: new Date(),
            },
          },
          subscriptions: {
            create: {
              planId: freePlan.id,
              status: "ACTIVE",
            },
          },
        },
        select: { id: true },
      });

      orgId = created.id;
      await db.user.update({ where: { id: user.id }, data: { activeOrganizationId: orgId } });
    }

    if (!orgId) continue;

    await db.candidate.updateMany({
      where: { createdById: user.id, organizationId: null },
      data: { organizationId: orgId },
    });
    await db.jobDescription.updateMany({
      where: { createdById: user.id, organizationId: null },
      data: { organizationId: orgId },
    });
    await db.interview.updateMany({
      where: { createdById: user.id, organizationId: null },
      data: { organizationId: orgId },
    });

    const interviewIds: Array<{ id: string }> = await db.interview.findMany({
      where: { createdById: user.id, organizationId: orgId },
      select: { id: true },
      take: 5000,
    });
    if (interviewIds.length > 0) {
      await db.report.updateMany({
        where: { interviewId: { in: interviewIds.map((i) => i.id) }, organizationId: null },
        data: { organizationId: orgId },
      });
    }

    const existingSub = await db.subscription.findFirst({
      where: { organizationId: orgId },
      select: { id: true },
    });
    if (!existingSub) {
      await db.subscription.create({
        data: { organizationId: orgId, planId: freePlan.id, status: "ACTIVE" },
        select: { id: true },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    throw error;
  });
