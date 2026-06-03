/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,email]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.

*/
-- Deduplicate (organizationId, email) by nulling email on duplicates.
-- This preserves row IDs and avoids cascading deletes from related records.
WITH ranked AS (
  SELECT
    id,
    "organizationId",
    email,
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", email
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Candidate"
  WHERE email IS NOT NULL
)
UPDATE "Candidate" c
SET email = NULL
FROM ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_organizationId_email_key" ON "Candidate"("organizationId", "email");
