import "server-only";

import type { PostingFit } from "@/lib/fit";
import type { FoundPosting } from "@/lib/job-search/search";
import { userDb } from "@/lib/db";

// Scores kept per posting (#208): from Score in Find jobs, or the job agent.

/** Keeps a posting's score, replacing an older one. */
export async function saveScore(posting: Pick<FoundPosting, "source" | "externalId">, fit: PostingFit, scoredWith: string): Promise<void> {
  const db = await userDb();
  const where = { userId_source_externalId: { userId: db.$userId, source: posting.source, externalId: posting.externalId } };
  const data = { score: fit.score, reasons: fit.reasons, redFlags: fit.redFlags, scoredWith };
  await db.postingScore.upsert({ where, create: { source: posting.source, externalId: posting.externalId, ...data }, update: data });
}
