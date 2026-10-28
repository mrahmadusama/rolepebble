import { describe, expect, it } from "vitest";

import { adzuna } from "./adzuna";
import { EMPTY_QUERY } from "./search";

// Checks against the real Adzuna service, skipped unless asked for. It
// spends two calls from the day's allowance:
//
//   JOBS_LIVE=adzuna ADZUNA_TEST_APP_ID=… ADZUNA_TEST_KEY=… docker/bin/yarn vitest run src/lib/job-search/sources.live.test.ts

const live = new Set((process.env.JOBS_LIVE ?? "").split(",").map((name) => name.trim()));
const adzunaKey = { appId: process.env.ADZUNA_TEST_APP_ID ?? "", key: process.env.ADZUNA_TEST_KEY ?? "" };
const query = { ...EMPTY_QUERY, keywords: "software developer", place: "Hamburg", country: "de", radiusKm: 25 as const };

describe.runIf(live.has("adzuna") && adzunaKey.appId && adzunaKey.key)("Adzuna (live)", { timeout: 30_000 }, () => {
  it("finds postings near a place, and a second page", async () => {
    const page = await adzuna.search(query, adzunaKey, null);
    expect(page.postings.length).toBeGreaterThan(0);
    expect(page.postings.every((posting) => posting.title && !posting.complete)).toBe(true);
    expect((await adzuna.search(query, adzunaKey, page.next)).postings.length).toBeGreaterThan(0);
  });
});
