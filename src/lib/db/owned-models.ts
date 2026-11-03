import type { Prisma } from "@/generated/prisma/client";

// Which tables hold a user's own data. Each has a `userId` the database fills
// in (prisma/schema.prisma); owned-models.test.ts checks this list against
// the schema, so a new table can't be left out by accident.

/** Per-user tables: the scoped client only ever reads or writes the user's own rows. */
export const OWNED_MODELS: ReadonlySet<Prisma.ModelName> = new Set<Prisma.ModelName>([
  "ProfileField",
  "Skill",
  "Language",
  "Experience",
  "ExperienceSkill",
  "Project",
  "ProjectSkill",
  "Education",
  "Publication",
  "Reference",
  "Fact",
  "Theme",
  "Setting",
  "Application",
  "StatusEvent",
  "Document",
  "DocumentVersion",
  "ChatMessage",
  "Note",
  "Posting",
  "ClaudePaste",
  "AgentCandidate",
  "PostingScore",
  "PostingSearch",
  "Startup",
  "StartupBlock",
  "GoogleAccount",
  "EmailMessage",
  "Job",
]);

/** Owned, but rows without an owner are shared by everyone: the built-in themes. */
export const SHARED_ROWS_MODELS: ReadonlySet<Prisma.ModelName> = new Set<Prisma.ModelName>(["Theme"]);

/** Tables that aren't any user's data. The scoped client refuses them: use the system client. */
export const SYSTEM_MODELS: ReadonlySet<Prisma.ModelName> = new Set<Prisma.ModelName>(["User", "LoginThrottle"]);
