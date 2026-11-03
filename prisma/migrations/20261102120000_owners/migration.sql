-- Phase 2, step 1: accounts and owners. Every row of a user's data gets a
-- "userId". Until sign-in knows users (a later migration), everything belongs
-- to the built-in "owner" account created here, so nothing changes yet.

-- (Added by hand) Whose data a statement works on: the app sets app.user_id for
-- each query (src/lib/db); without it, the owner account.
CREATE FUNCTION rp_current_user_id() RETURNS TEXT
LANGUAGE sql STABLE
AS $$ SELECT COALESCE(NULLIF(current_setting('app.user_id', true), ''), 'owner') $$;

-- AlterTable
ALTER TABLE "ProfileField" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Language" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Experience" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "ExperienceSkill" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "ProjectSkill" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Education" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Reference" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Fact" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Theme" ADD COLUMN     "userId" TEXT DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "StatusEvent" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Posting" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "ClaudePaste" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "AgentCandidate" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "PostingScore" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "PostingSearch" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Startup" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "StartupBlock" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "GoogleAccount" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT rp_current_user_id();

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "lastSignInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- (Added by hand) The account all existing data belongs to.
INSERT INTO "User" ("id", "email", "updatedAt") VALUES ('owner', 'owner@rolepebble.invalid', CURRENT_TIMESTAMP);

-- (Added by hand) Built-in themes belong to no one: everyone shares them.
UPDATE "Theme" SET "userId" = NULL WHERE "builtIn";
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_owner_check" CHECK ("builtIn" = ("userId" IS NULL));

-- CreateIndex
CREATE INDEX "ProfileField_userId_idx" ON "ProfileField"("userId");

-- CreateIndex
CREATE INDEX "Skill_userId_idx" ON "Skill"("userId");

-- CreateIndex
CREATE INDEX "Language_userId_idx" ON "Language"("userId");

-- CreateIndex
CREATE INDEX "Experience_userId_idx" ON "Experience"("userId");

-- CreateIndex
CREATE INDEX "ExperienceSkill_userId_idx" ON "ExperienceSkill"("userId");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "ProjectSkill_userId_idx" ON "ProjectSkill"("userId");

-- CreateIndex
CREATE INDEX "Education_userId_idx" ON "Education"("userId");

-- CreateIndex
CREATE INDEX "Publication_userId_idx" ON "Publication"("userId");

-- CreateIndex
CREATE INDEX "Reference_userId_idx" ON "Reference"("userId");

-- CreateIndex
CREATE INDEX "Fact_userId_idx" ON "Fact"("userId");

-- CreateIndex
CREATE INDEX "Theme_userId_idx" ON "Theme"("userId");

-- CreateIndex
CREATE INDEX "Setting_userId_idx" ON "Setting"("userId");

-- CreateIndex
CREATE INDEX "Application_userId_idx" ON "Application"("userId");

-- CreateIndex
CREATE INDEX "StatusEvent_userId_idx" ON "StatusEvent"("userId");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "DocumentVersion_userId_idx" ON "DocumentVersion"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");

-- CreateIndex
CREATE INDEX "Note_userId_idx" ON "Note"("userId");

-- CreateIndex
CREATE INDEX "Posting_userId_idx" ON "Posting"("userId");

-- CreateIndex
CREATE INDEX "ClaudePaste_userId_idx" ON "ClaudePaste"("userId");

-- CreateIndex
CREATE INDEX "AgentCandidate_userId_idx" ON "AgentCandidate"("userId");

-- CreateIndex
CREATE INDEX "PostingScore_userId_idx" ON "PostingScore"("userId");

-- CreateIndex
CREATE INDEX "PostingSearch_userId_idx" ON "PostingSearch"("userId");

-- CreateIndex
CREATE INDEX "Startup_userId_idx" ON "Startup"("userId");

-- CreateIndex
CREATE INDEX "StartupBlock_userId_idx" ON "StartupBlock"("userId");

-- CreateIndex
CREATE INDEX "GoogleAccount_userId_idx" ON "GoogleAccount"("userId");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_idx" ON "EmailMessage"("userId");

-- CreateIndex
CREATE INDEX "Job_userId_idx" ON "Job"("userId");

-- AddForeignKey
ALTER TABLE "ProfileField" ADD CONSTRAINT "ProfileField_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Language" ADD CONSTRAINT "Language_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceSkill" ADD CONSTRAINT "ExperienceSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSkill" ADD CONSTRAINT "ProjectSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaudePaste" ADD CONSTRAINT "ClaudePaste_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCandidate" ADD CONSTRAINT "AgentCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingScore" ADD CONSTRAINT "PostingScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingSearch" ADD CONSTRAINT "PostingSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Startup" ADD CONSTRAINT "Startup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupBlock" ADD CONSTRAINT "StartupBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAccount" ADD CONSTRAINT "GoogleAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- (Added by hand) A row may only point at its own user's rows: an experience's
-- skill, a document's application or theme, and so on. Foreign keys can't
-- check that, so a trigger does. A built-in theme (no owner) counts as
-- everyone's. SECURITY DEFINER: it must see the parent row even when row-level
-- security would hide another user's row. A missing parent is left to the
-- foreign key.
CREATE FUNCTION rp_same_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  parent_table TEXT := TG_ARGV[0];
  fk_column TEXT := TG_ARGV[1];
  shared_allowed BOOLEAN := COALESCE(TG_ARGV[2]::BOOLEAN, false);
  parent_id TEXT := to_jsonb(NEW) ->> fk_column;
  parent_exists BOOLEAN;
  parent_owner TEXT;
BEGIN
  IF parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- EXECUTE doesn't set FOUND, so the query says whether the row exists.
  EXECUTE format('SELECT true, "userId" FROM %I WHERE "id" = $1', parent_table) INTO parent_exists, parent_owner USING parent_id;
  IF parent_exists IS NULL THEN
    RETURN NEW;
  END IF;
  IF parent_owner IS NULL AND shared_allowed THEN
    RETURN NEW;
  END IF;
  IF parent_owner IS DISTINCT FROM NEW."userId" THEN
    RAISE EXCEPTION 'rp_same_owner: %.% points at another user''s % row', TG_TABLE_NAME, fk_column, parent_table
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "ExperienceSkill_experienceId_same_owner" BEFORE INSERT OR UPDATE OF "experienceId", "userId" ON "ExperienceSkill"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Experience', 'experienceId');

CREATE TRIGGER "ExperienceSkill_skillId_same_owner" BEFORE INSERT OR UPDATE OF "skillId", "userId" ON "ExperienceSkill"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Skill', 'skillId');

CREATE TRIGGER "ProjectSkill_projectId_same_owner" BEFORE INSERT OR UPDATE OF "projectId", "userId" ON "ProjectSkill"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Project', 'projectId');

CREATE TRIGGER "ProjectSkill_skillId_same_owner" BEFORE INSERT OR UPDATE OF "skillId", "userId" ON "ProjectSkill"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Skill', 'skillId');

CREATE TRIGGER "Fact_applicationId_same_owner" BEFORE INSERT OR UPDATE OF "applicationId", "userId" ON "Fact"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Application', 'applicationId');

CREATE TRIGGER "StatusEvent_applicationId_same_owner" BEFORE INSERT OR UPDATE OF "applicationId", "userId" ON "StatusEvent"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Application', 'applicationId');

CREATE TRIGGER "Document_applicationId_same_owner" BEFORE INSERT OR UPDATE OF "applicationId", "userId" ON "Document"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Application', 'applicationId');

CREATE TRIGGER "Document_themeId_same_owner" BEFORE INSERT OR UPDATE OF "themeId", "userId" ON "Document"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Theme', 'themeId', 'true');

CREATE TRIGGER "DocumentVersion_documentId_same_owner" BEFORE INSERT OR UPDATE OF "documentId", "userId" ON "DocumentVersion"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Document', 'documentId');

CREATE TRIGGER "ChatMessage_applicationId_same_owner" BEFORE INSERT OR UPDATE OF "applicationId", "userId" ON "ChatMessage"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Application', 'applicationId');

CREATE TRIGGER "Note_applicationId_same_owner" BEFORE INSERT OR UPDATE OF "applicationId", "userId" ON "Note"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Application', 'applicationId');

CREATE TRIGGER "Posting_applicationId_same_owner" BEFORE INSERT OR UPDATE OF "applicationId", "userId" ON "Posting"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Application', 'applicationId');

CREATE TRIGGER "AgentCandidate_applicationId_same_owner" BEFORE INSERT OR UPDATE OF "applicationId", "userId" ON "AgentCandidate"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Application', 'applicationId');

CREATE TRIGGER "Startup_applicationId_same_owner" BEFORE INSERT OR UPDATE OF "applicationId", "userId" ON "Startup"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Application', 'applicationId');

CREATE TRIGGER "EmailMessage_applicationId_same_owner" BEFORE INSERT OR UPDATE OF "applicationId", "userId" ON "EmailMessage"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Application', 'applicationId');

CREATE TRIGGER "Job_applicationId_same_owner" BEFORE INSERT OR UPDATE OF "applicationId", "userId" ON "Job"
  FOR EACH ROW EXECUTE FUNCTION rp_same_owner('Application', 'applicationId');
