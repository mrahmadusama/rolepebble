import "server-only";

import { JobStatus } from "@/generated/prisma/enums";
import { forEachUser, userDb } from "@/lib/db";
import { logServerError } from "@/lib/log";
import { loadSettings } from "@/lib/settings-data";

import { removeOldZips } from "./zip-pdfs";

// A finished job is only needed for a while: for a reload to find it again,
// for Undo on its toast, for a resume reading or a New application draft
// still waiting to be used. What it holds (a posting, a resume's text,
// drafts) is either in an application by then or was never used, so it's
// deleted once it's older than "Keep task data for" in Settings → Your data,
// each user's by their own setting. A plain timer in this process, like the
// nightly backups.

const HOUR_MS = 60 * 60 * 1000;
/** How often the sweep runs. */
const EVERY_MS = 15 * 60 * 1000;

/** Deletes the current user's finished jobs older than their retention and their expired postings pasted for Claude (#221); returns how many jobs went. */
export async function sweepFinishedJobs(now = new Date(), hours?: number): Promise<number> {
  const keep = hours ?? (await loadSettings()).jobRetentionHours;
  const cutoff = new Date(now.getTime() - keep * HOUR_MS);
  const db = await userDb();
  const { count } = await db.job.deleteMany({
    where: {
      status: { in: [JobStatus.DONE, JobStatus.FAILED] },
      OR: [{ finishedAt: { lt: cutoff } }, { finishedAt: null, updatedAt: { lt: cutoff } }],
    },
  });
  await db.claudePaste.deleteMany({ where: { expiresAt: { lte: now } } });
  return count;
}

/** One sweep: every user's jobs, then the zips nobody downloaded. */
export async function sweepEverything(now = new Date()): Promise<void> {
  await forEachUser("job sweep", () => sweepFinishedJobs(now));
  await removeOldZips(now.getTime());
}

const globalForSweep = globalThis as unknown as { jobSweepTimer?: ReturnType<typeof setInterval> };

/** Sweeps now and every 15 minutes, once per process (dev reloads keep the timer they have). */
export function startJobSweep(): void {
  if (globalForSweep.jobSweepTimer) return;
  const sweep = () => void sweepEverything().catch((error: unknown) => logServerError("job sweep", error));
  globalForSweep.jobSweepTimer = setInterval(sweep, EVERY_MS);
  // Don't keep the process alive just for this.
  globalForSweep.jobSweepTimer.unref?.();
  sweep();
}
