/*
  Warnings:

  - Added the required column `createdById` to the `QuestionBank` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `QuestionBank` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "QuestionVisibility" AS ENUM ('PRIVATE', 'ORGANIZATION');

-- AlterTable
ALTER TABLE "QuestionBank" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "evaluationGuideText" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "subDomain" TEXT,
ADD COLUMN     "visibility" "QuestionVisibility" NOT NULL DEFAULT 'ORGANIZATION';

WITH defaults AS (
  SELECT
    (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1) AS "defaultUserId",
    (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) AS "defaultOrgId"
)
UPDATE "QuestionBank" qb
SET
  "createdById" = COALESCE(qb."createdById", (SELECT "defaultUserId" FROM defaults)),
  "organizationId" = COALESCE(qb."organizationId", (SELECT "defaultOrgId" FROM defaults)),
  "visibility" = COALESCE(qb."visibility", 'ORGANIZATION'::"QuestionVisibility"),
  "domain" = COALESCE(
    qb."domain",
    CASE
      WHEN lower(qb."topic") IN ('kubernetes') THEN 'DevOps'
      WHEN lower(qb."topic") IN ('terraform') THEN 'DevOps'
      WHEN lower(qb."topic") IN ('incident response') THEN 'SRE / Observability'
      WHEN lower(qb."topic") IN ('observability') THEN 'SRE / Observability'
      WHEN lower(qb."topic") IN ('networking') THEN 'Cloud/Infrastructure'
      ELSE NULL
    END
  ),
  "subDomain" = COALESCE(
    qb."subDomain",
    CASE
      WHEN lower(qb."topic") IN ('kubernetes') THEN 'Kubernetes'
      WHEN lower(qb."topic") IN ('terraform') THEN 'Terraform'
      WHEN lower(qb."topic") IN ('incident response') THEN 'Incident Response'
      WHEN lower(qb."topic") IN ('observability') THEN 'Monitoring'
      WHEN lower(qb."topic") IN ('networking') THEN 'Networking'
      ELSE NULL
    END
  );

ALTER TABLE "QuestionBank" ALTER COLUMN "createdById" SET NOT NULL;
ALTER TABLE "QuestionBank" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "QuestionBank_organizationId_idx" ON "QuestionBank"("organizationId");

-- CreateIndex
CREATE INDEX "QuestionBank_createdById_idx" ON "QuestionBank"("createdById");

-- CreateIndex
CREATE INDEX "QuestionBank_visibility_idx" ON "QuestionBank"("visibility");

-- CreateIndex
CREATE INDEX "QuestionBank_domain_idx" ON "QuestionBank"("domain");

-- CreateIndex
CREATE INDEX "QuestionBank_subDomain_idx" ON "QuestionBank"("subDomain");

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
