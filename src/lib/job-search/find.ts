import "server-only";

import { credentialsFor, loadJobSearchConfig, requestContext } from "./config";
import { JobSearchError } from "./errors";
import { postingDetails, searchPostings } from "./index";
import { isJobSource, type FoundPosting, type JobSource, type SearchPage, type SearchProblem, type SearchQuery } from "./search";

// Asking a job source from Find jobs (E14-6): a page of postings, or what
// went wrong in words for the screen. Kept searches are in
// src/lib/posting-searches.ts.

/**
 * One page for `query` from `source`, the one chosen in Settings unless
 * given (a kept search goes on with the source it ran on).
 */
export async function askSource(
  query: SearchQuery,
  { source, next = null }: { source?: JobSource; next?: string | null } = {},
): Promise<({ ok: true; source: JobSource } & SearchPage) | SearchProblem> {
  const config = await loadJobSearchConfig();
  const from = source ?? config.source;
  if (!from) return { ok: false, problem: "off", message: "Choose where to search in Settings → Job search first." };
  if (!query.country) return { ok: false, problem: "no-country", message: "Choose a country to search in." };
  try {
    const page = await searchPostings(from, credentialsFor(config, from), query, next, requestContext(from));
    return { ok: true, source: from, ...page };
  } catch (error) {
    if (error instanceof JobSearchError) return { ok: false, problem: error.problem, message: error.message };
    throw error;
  }
}

/**
 * The whole text of a posting, from its own source (which may no longer be
 * the one chosen, for a saved posting); null when it can't be had, as for a
 * posting kept from a source since removed.
 */
export async function fullText(posting: FoundPosting): Promise<string | null> {
  if (posting.complete) return posting.description;
  if (!isJobSource(posting.source)) return null;
  try {
    return await postingDetails(posting.source, credentialsFor(await loadJobSearchConfig(), posting.source), posting, requestContext(posting.source));
  } catch (error) {
    if (error instanceof JobSearchError) return null;
    throw error;
  }
}
