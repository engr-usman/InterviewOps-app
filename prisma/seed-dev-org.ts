import { prisma } from "../src/lib/prisma";

const defaultOrgQuestions = [
  {
    domain: "DevOps",
    subDomain: "Kubernetes",
    topic: "Kubernetes",
    prompt: "Explain how Kubernetes scheduling works. What factors influence pod placement?",
    difficulty: "MID_LEVEL" as const,
    seniorityLevel: "MID" as const,
  },
  {
    domain: "DevOps",
    subDomain: "Terraform",
    topic: "Terraform",
    prompt: "How do you structure Terraform for multiple environments (dev/stage/prod) while keeping modules reusable?",
    difficulty: "MID_LEVEL" as const,
    seniorityLevel: "MID" as const,
  },
  {
    domain: "SRE / Observability",
    subDomain: "Incident Response",
    topic: "Incident Response",
    prompt: "Walk through your incident response process. How do you handle triage, communication, and postmortems?",
    difficulty: "MID_LEVEL" as const,
    seniorityLevel: "SENIOR" as const,
  },
  {
    domain: "SRE / Observability",
    subDomain: "Monitoring",
    topic: "Observability",
    prompt:
      "How do you decide what to monitor? Explain the difference between metrics, logs, and traces and how you use them together.",
    difficulty: "BEGINNER" as const,
    seniorityLevel: "MID" as const,
  },
  {
    domain: "Cloud/Infrastructure",
    subDomain: "Networking",
    topic: "Networking",
    prompt: "A service is intermittently timing out. What steps do you take to diagnose network vs application issues?",
    difficulty: "SENIOR" as const,
    seniorityLevel: "SENIOR" as const,
  },
] as const;

async function ensureDefaultQuestionsForOrganization(params: { organizationId: string; createdById: string }) {
  for (const q of defaultOrgQuestions) {
    const existing = await prisma.questionBank.findFirst({
      where: { organizationId: params.organizationId, prompt: q.prompt },
      select: { id: true },
    });

    if (existing) {
      await prisma.questionBank.update({
        where: { id: existing.id },
        data: {
          visibility: "ORGANIZATION",
          createdById: params.createdById,
          domain: q.domain,
          subDomain: q.subDomain,
          topic: q.topic,
          difficulty: q.difficulty,
          seniorityLevel: q.seniorityLevel,
        },
        select: { id: true },
      });
      continue;
    }

    await prisma.questionBank.create({
      data: {
        organizationId: params.organizationId,
        createdById: params.createdById,
        visibility: "ORGANIZATION",
        domain: q.domain,
        subDomain: q.subDomain,
        topic: q.topic,
        prompt: q.prompt,
        evaluationGuideText: null,
        type: "FIXED",
        difficulty: q.difficulty,
        seniorityLevel: q.seniorityLevel,
        sourceType: "MANUAL",
        tagsJson: [],
      },
      select: { id: true },
    });
  }
}

async function main() {
  const targetEmail = "admin@interviewops.local";

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: { id: true, email: true, activeOrganizationId: true },
  });
  if (!user) {
    throw new Error(`User not found: ${targetEmail}`);
  }

  const freePlan =
    (await prisma.subscriptionPlan.findUnique({
      where: { code: "FREE" },
      select: { id: true },
    })) ??
    (await prisma.subscriptionPlan.create({
      data: {
        code: "FREE",
        name: "Free",
        description: "Free plan",
      },
      select: { id: true },
    }));

  const org = await prisma.organization.upsert({
    where: { slug: "admin" },
    update: { name: "admin Organization", createdById: user.id },
    create: {
      name: "admin Organization",
      slug: "admin",
      createdById: user.id,
    },
    select: { id: true },
  });

  const existingSub = await prisma.subscription.findFirst({
    where: { organizationId: org.id },
    select: { id: true, status: true },
  });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: freePlan.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });
  } else if (existingSub.status !== "ACTIVE") {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { status: "ACTIVE" },
      select: { id: true },
    });
  }

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: { role: "OWNER" },
    create: {
      organizationId: org.id,
      userId: user.id,
      role: "OWNER",
      joinedAt: new Date(),
    },
    select: { id: true },
  });

  if (user.activeOrganizationId !== org.id) {
    await prisma.user.update({
      where: { id: user.id },
      data: { activeOrganizationId: org.id },
      select: { id: true },
    });
  }

  const allOrgs = await prisma.organization.findMany({
    select: { id: true, createdById: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  for (const o of allOrgs) {
    await ensureDefaultQuestionsForOrganization({
      organizationId: o.id,
      createdById: o.createdById ?? user.id,
    });
  }

  process.stdout.write(`seed:dev-org ok (user=${user.email}, org=${org.id})\n`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    throw error;
  });
