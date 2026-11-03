-- Phase 2, step 3: profile fields and settings are one value per key for
-- each user, and skill and language names unique per user.

-- DropIndex
DROP INDEX "Skill_name_key";

-- DropIndex
DROP INDEX "Language_name_key";

-- AlterTable
ALTER TABLE "ProfileField" DROP CONSTRAINT "ProfileField_pkey",
ADD CONSTRAINT "ProfileField_pkey" PRIMARY KEY ("userId", "key");

-- AlterTable
ALTER TABLE "Setting" DROP CONSTRAINT "Setting_pkey",
ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_userId_name_key" ON "Skill"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Language_userId_name_key" ON "Language"("userId", "name");

