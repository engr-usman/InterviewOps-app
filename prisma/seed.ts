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

  await prisma.questionBank.createMany({
    data: [
      {
        topic: "Kubernetes",
        prompt: "Explain how Kubernetes scheduling works. What factors influence pod placement?",
        type: "FIXED",
        difficulty: "MID_LEVEL",
        seniorityLevel: "MID",
        sourceType: "MANUAL",
        tagsJson: ["kubernetes", "scheduling"],
      },
      {
        topic: "Terraform",
        prompt:
          "How do you structure Terraform for multiple environments (dev/stage/prod) while keeping modules reusable?",
        type: "FIXED",
        difficulty: "MID_LEVEL",
        seniorityLevel: "MID",
        sourceType: "MANUAL",
        tagsJson: ["terraform", "iac"],
      },
      {
        topic: "Incident Response",
        prompt:
          "Walk through your incident response process. How do you handle triage, communication, and postmortems?",
        type: "FIXED",
        difficulty: "MID_LEVEL",
        seniorityLevel: "SENIOR",
        sourceType: "MANUAL",
        tagsJson: ["sre", "incident-response"],
      },
      {
        topic: "Observability",
        prompt:
          "How do you decide what to monitor? Explain the difference between metrics, logs, and traces and how you use them together.",
        type: "FIXED",
        difficulty: "BEGINNER",
        seniorityLevel: "MID",
        sourceType: "MANUAL",
        tagsJson: ["observability", "metrics", "logs", "tracing"],
      },
      {
        topic: "Networking",
        prompt:
          "A service is intermittently timing out. What steps do you take to diagnose network vs application issues?",
        type: "FIXED",
        difficulty: "SENIOR",
        seniorityLevel: "SENIOR",
        sourceType: "MANUAL",
        tagsJson: ["networking", "debugging"],
      },
    ],
    skipDuplicates: true,
  });

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
