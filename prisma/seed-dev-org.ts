import { prisma } from "../src/lib/prisma";

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
