import "server-only";

import { OWNER_ID, runAsUser } from "@/lib/db";

/**
 * Starts what runs in the background, once per server (src/instrumentation.ts).
 * The schedulers work on the owner's data until they go through every user's
 * (Phase 2, PR 6): a timer keeps the user it was started with.
 */
export async function startSchedules(): Promise<void> {
  await runAsUser(OWNER_ID, startAll);
}

async function startAll(): Promise<void> {
  // AI jobs left running by the previous process can't finish (E6-7).
  const { recoverInterruptedJobs } = await import("@/lib/jobs/runner");
  const { logServerError } = await import("@/lib/log");
  await recoverInterruptedJobs().catch((error: unknown) => logServerError("startup", error));

  // Finished jobs, with what they were given and wrote, are deleted after a while.
  const { startJobSweep } = await import("@/lib/jobs/retention");
  startJobSweep();

  // Nightly backups at 03:00, while they're switched on (E10-7).
  const { startBackupSchedule } = await import("@/lib/backup-schedule");
  startBackupSchedule();

  // The inbox check, while a Google account is connected (E15-3) and Gmail is on.
  const { googleEnabled } = await import("@/lib/features");
  if (googleEnabled()) {
    const { startInboxSchedule } = await import("@/lib/google/sync");
    startInboxSchedule();
  }

  // The job agent's daily run, while it's on (E16-4).
  const { startAgentSchedule } = await import("@/lib/agent/schedule");
  startAgentSchedule();

  // Startups' daily refresh, once it was refreshed by hand and while the screen is in use (#222).
  const { startStartupsSchedule } = await import("@/lib/startups/schedule");
  startStartupsSchedule();
}
