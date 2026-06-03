-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "assignedInterviewerId" TEXT;

-- CreateIndex
CREATE INDEX "Interview_assignedInterviewerId_idx" ON "Interview"("assignedInterviewerId");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_assignedInterviewerId_fkey" FOREIGN KEY ("assignedInterviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
