import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/prisma";

async function main() {
  const adminName = process.env.SEED_ADMIN_NAME ?? process.env.ADMIN_NAME ?? "Admin";
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed an admin user.");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
      role: "ADMIN",
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      name: adminName,
    },
  });

  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { code: "FREE" },
    update: { name: "Free" },
    create: { code: "FREE", name: "Free", description: "Free plan" },
    select: { id: true },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "admin" },
    update: { name: "admin Organization", createdById: adminUser.id },
    create: {
      name: "admin Organization",
      slug: "admin",
      createdById: adminUser.id,
    },
    select: { id: true },
  });

  const existingSub = await prisma.subscription.findFirst({
    where: { organizationId: org.id },
    select: { id: true },
  });
  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { planId: freePlan.id, status: "ACTIVE" },
      select: { id: true },
    });
  } else {
    await prisma.subscription.create({
      data: { organizationId: org.id, planId: freePlan.id, status: "ACTIVE" },
      select: { id: true },
    });
  }

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: adminUser.id } },
    update: { role: "OWNER" },
    create: { organizationId: org.id, userId: adminUser.id, role: "OWNER" },
    select: { id: true },
  });

  await prisma.user.update({
    where: { id: adminUser.id },
    data: { activeOrganizationId: org.id },
    select: { id: true },
  });

  const skills = [
    { name: "Linux", slug: "linux", category: "OS" },
    { name: "Kubernetes", slug: "kubernetes", category: "Containers" },
    { name: "Docker", slug: "docker", category: "Containers" },
    { name: "Terraform", slug: "terraform", category: "IaC" },
    { name: "AWS", slug: "aws", category: "Cloud" },
    { name: "GCP", slug: "gcp", category: "Cloud" },
    { name: "Azure", slug: "azure", category: "Cloud" },
    { name: "CI/CD", slug: "ci-cd", category: "Delivery" },
    { name: "Observability", slug: "observability", category: "SRE" },
    { name: "Incident Response", slug: "incident-response", category: "SRE" },
    { name: "Networking", slug: "networking", category: "Fundamentals" },
    { name: "Security", slug: "security", category: "Fundamentals" },
  ];

  await prisma.skill.createMany({
    data: skills,
    skipDuplicates: true,
  });

  const seededQuestions = [
    {
      domain: "DevOps",
      subDomain: "Kubernetes",
      topic: "Kubernetes",
      prompt: "Explain how Kubernetes scheduling works. What factors influence pod placement?",
      type: "FIXED" as const,
      difficulty: "MID_LEVEL" as const,
      seniorityLevel: "MID" as const,
      sourceType: "MANUAL" as const,
      visibility: "ORGANIZATION" as const,
      tagsJson: ["kubernetes", "scheduling"],
    },
    {
      domain: "DevOps",
      subDomain: "Terraform",
      topic: "Terraform",
      prompt: "How do you structure Terraform for multiple environments (dev/stage/prod) while keeping modules reusable?",
      type: "FIXED" as const,
      difficulty: "MID_LEVEL" as const,
      seniorityLevel: "MID" as const,
      sourceType: "MANUAL" as const,
      visibility: "ORGANIZATION" as const,
      tagsJson: ["terraform", "iac"],
    },
    {
      domain: "SRE / Observability",
      subDomain: "Incident Response",
      topic: "Incident Response",
      prompt: "Walk through your incident response process. How do you handle triage, communication, and postmortems?",
      type: "FIXED" as const,
      difficulty: "MID_LEVEL" as const,
      seniorityLevel: "SENIOR" as const,
      sourceType: "MANUAL" as const,
      visibility: "ORGANIZATION" as const,
      tagsJson: ["sre", "incident-response"],
    },
    {
      domain: "SRE / Observability",
      subDomain: "Monitoring",
      topic: "Observability",
      prompt:
        "How do you decide what to monitor? Explain the difference between metrics, logs, and traces and how you use them together.",
      type: "FIXED" as const,
      difficulty: "BEGINNER" as const,
      seniorityLevel: "MID" as const,
      sourceType: "MANUAL" as const,
      visibility: "ORGANIZATION" as const,
      tagsJson: ["observability", "metrics", "logs", "tracing"],
    },
    {
      domain: "Cloud/Infrastructure",
      subDomain: "Networking",
      topic: "Networking",
      prompt: "A service is intermittently timing out. What steps do you take to diagnose network vs application issues?",
      type: "FIXED" as const,
      difficulty: "SENIOR" as const,
      seniorityLevel: "SENIOR" as const,
      sourceType: "MANUAL" as const,
      visibility: "ORGANIZATION" as const,
      tagsJson: ["networking", "debugging"],
    },
  ];

  for (const q of seededQuestions) {
    const exists = await prisma.questionBank.findFirst({
      where: { organizationId: org.id, prompt: q.prompt },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.questionBank.create({
      data: {
        organizationId: org.id,
        createdById: adminUser.id,
        visibility: q.visibility,
        domain: q.domain,
        subDomain: q.subDomain,
        topic: q.topic,
        prompt: q.prompt,
        type: q.type,
        difficulty: q.difficulty,
        seniorityLevel: q.seniorityLevel,
        sourceType: q.sourceType,
        tagsJson: q.tagsJson,
      },
      select: { id: true },
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "app.name" },
    update: { settingValue: "InterviewOps", isSystem: true, updatedById: adminUser.id },
    create: {
      key: "app.name",
      settingValue: "InterviewOps",
      description: "Application display name",
      isSystem: true,
      updatedById: adminUser.id,
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "security.passwordHashRounds" },
    update: { settingValue: 12, isSystem: true, updatedById: adminUser.id },
    create: {
      key: "security.passwordHashRounds",
      settingValue: 12,
      description: "Bcrypt hash rounds used for seeded credentials",
      isSystem: true,
      updatedById: adminUser.id,
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "uploads.maxResumeSizeMb" },
    update: { settingValue: 10, isSystem: true, updatedById: adminUser.id },
    create: {
      key: "uploads.maxResumeSizeMb",
      settingValue: 10,
      description: "Maximum allowed resume upload size in MB (UI will enforce later)",
      isSystem: true,
      updatedById: adminUser.id,
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "ai.provider" },
    update: { settingValue: "unset", isSystem: true, updatedById: adminUser.id },
    create: {
      key: "ai.provider",
      settingValue: "unset",
      description: "AI provider key (configure later)",
      isSystem: true,
      updatedById: adminUser.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    throw error;
  });
