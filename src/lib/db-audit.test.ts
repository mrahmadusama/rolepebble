import { globSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Phase 2: code reaches a user's data only through the scoped client
// (`userDb()`, src/lib/db), which limits every query to that user. This test
// keeps the raw client (`@/lib/prisma`, which sees everyone's data) to the
// few places that need it, each with its reason.

/** Files that use the raw client for good, and why. */
const SYSTEM_CLIENT: Record<string, string> = {
  "src/lib/db/scoped.ts": "builds every user's client on it",
  "src/app/api/health/route.ts": "a SELECT 1 that touches no one's data",
  "src/app/login/actions.ts": "sign-in throttling, before anyone is signed in",
};

/**
 * Files not moved to the scoped client yet (Phase 2, PRs 3–8). This list
 * only shrinks: a file that moves comes off it, and the test fails until it
 * does, so the list stays true.
 */
const NOT_MOVED_YET = new Set([
  "src/app/(app)/agent/actions.ts",
  "src/app/(app)/inbox/page.tsx",
  "src/app/(app)/jobs/page.tsx",
  "src/app/(app)/settings/actions.ts",
  "src/app/(app)/settings/page.tsx",
  "src/app/api/export/route.ts",
  "src/app/api/import/route.ts",
  "src/app/dev/documents/page.tsx",
  "src/app/dev/ui/page.tsx",
  "src/lib/agent/draft.ts",
  "src/lib/agent/run.ts",
  "src/lib/agent/schedule.ts",
  "src/lib/agent/view.ts",
  "src/lib/backups.ts",
  "src/lib/connector/handoff.ts",
  "src/lib/connector/tools.ts",
  "src/lib/google/account.ts",
  "src/lib/google/actions.ts",
  "src/lib/google/availability.ts",
  "src/lib/google/calendar-data.ts",
  "src/lib/google/inbox-data.ts",
  "src/lib/google/sync.ts",
  "src/lib/jobs/draft-reply.ts",
  "src/lib/jobs/import-profile.ts",
  "src/lib/jobs/retention.ts",
  "src/lib/jobs/runner.ts",
  "src/lib/jobs/zip-pdfs.ts",
  "src/lib/posting-scores.ts",
  "src/lib/posting-searches.ts",
  "src/lib/postings.ts",
  "src/lib/startups/refresh.ts",
  "src/lib/startups/store.ts",
]);

const sources = globSync("src/**/*.{ts,tsx}").filter(
  (file) => !/\.test\.tsx?$/.test(file) && !file.startsWith("src/generated/") && !file.startsWith("src/test/"),
);
const read = (file: string) => readFileSync(file, "utf8");
const usesRawClient = (source: string) => /from "@\/lib\/prisma"/.test(source);

describe("database access (Phase 2)", () => {
  it("keeps the raw client to the files allowed it", () => {
    const users = sources.filter((file) => usesRawClient(read(file)));
    const unexpected = users.filter((file) => !(file in SYSTEM_CLIENT) && !NOT_MOVED_YET.has(file));
    expect(unexpected, "use userDb() from @/lib/db instead of @/lib/prisma").toEqual([]);
  });

  it("lists only files that still use the raw client", () => {
    const stale = [...Object.keys(SYSTEM_CLIENT), ...NOT_MOVED_YET].filter((file) => !usesRawClient(read(file)));
    expect(stale, "take these off the lists in db-audit.test.ts").toEqual([]);
  });

  it("runs interactive transactions on a user's data with $userTransaction", () => {
    // Every query of the scoped client runs in a transaction of its own, which
    // Postgres can't nest.
    const offenders = sources.filter((file) => {
      const source = read(file);
      return /from "@\/lib\/db"/.test(source) && /\.\$transaction\(/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("never builds SQL from strings", () => {
    const offenders = sources.filter((file) => /\$(query|execute)RawUnsafe\(/.test(read(file)));
    expect(offenders, "use the tagged-template $queryRaw / $executeRaw").toEqual([]);
  });
});
