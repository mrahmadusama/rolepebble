-- Phase 2, step 5: postings, agent finds, scores and startups are unique per
-- user, so two users can keep the same posting or startup.

-- DropIndex
DROP INDEX "Posting_source_externalId_key";

-- DropIndex
DROP INDEX "AgentCandidate_dedupeKey_key";

-- DropIndex
DROP INDEX "AgentCandidate_source_externalId_key";

-- DropIndex
DROP INDEX "Startup_source_externalId_key";

-- AlterTable
ALTER TABLE "PostingScore" DROP CONSTRAINT "PostingScore_pkey",
ADD CONSTRAINT "PostingScore_pkey" PRIMARY KEY ("userId", "source", "externalId");

-- AlterTable
ALTER TABLE "StartupBlock" DROP CONSTRAINT "StartupBlock_pkey",
ADD CONSTRAINT "StartupBlock_pkey" PRIMARY KEY ("userId", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "Posting_userId_source_externalId_key" ON "Posting"("userId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCandidate_userId_source_externalId_key" ON "AgentCandidate"("userId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCandidate_userId_dedupeKey_key" ON "AgentCandidate"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Startup_userId_source_externalId_key" ON "Startup"("userId", "source", "externalId");
