import type { PostingSource } from "@/generated/prisma/enums";

import { isJobSource, type JobSource, type JSearchHost } from "./search";

/** What Settings → Job search may know about a source's key: never the key itself. "env" means it comes from the environment. */
export type JobKeyState = "none" | "set" | "unreadable" | "env";

/** What the Job search section starts from (E14-4). */
export type JobSearchSettingsView = {
  source: JobSource | "OFF";
  jsearch: { host: JSearchHost; keyState: JobKeyState };
  adzuna: { appId: string; keyState: JobKeyState };
};

export const JOB_KEY_UNREADABLE = "Your saved key can't be read. Please enter it again.";

/** Where to get a JSearch key, by where it's from. */
export const JSEARCH_KEY_URLS: Record<JSearchHost, string> = {
  openwebninja: "https://www.openwebninja.com/api/jsearch",
  rapidapi: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch",
};

/** How Settings → Job search and the Find jobs screen describe each source (E14). */
export type SourceInfo = {
  name: string;
  /** What it covers, in a line. */
  description: string;
  /** Cost and reach at a glance. */
  tag: string;
  /** Where to get a key; null when none is needed. */
  keyUrl: string | null;
  /** When used-up searches come back: "this month", "today"; null when there's no quota. */
  quotaPeriod: string | null;
  /** Shown with its results, as the source's terms ask. */
  attribution: string | null;
  /**
   * Where the attribution links, when the terms ask for a link: the source's
   * site for the posting's country when its link is on one (`local`), else
   * `home`. Null for a plain-text attribution.
   */
  attributionLink: { home: string; local: RegExp } | null;
  /** The countries it lists jobs in (ISO codes); null for every country. */
  countries: readonly string[] | null;
};

export const SOURCE_INFO: Record<JobSource, SourceInfo> = {
  JSEARCH: {
    name: "JSearch",
    description: "Postings from LinkedIn, Indeed, Glassdoor and company sites, through Google for Jobs.",
    tag: "Most countries · free key with 200 searches a month",
    keyUrl: "https://www.openwebninja.com/api/jsearch",
    quotaPeriod: "this month",
    attribution: null,
    attributionLink: null,
    countries: null,
  },
  ADZUNA: {
    name: "Adzuna",
    description: "Adzuna's own job index in 19 countries. It only shares the start of each posting.",
    tag: "19 countries · free key, about 250 searches a day",
    keyUrl: "https://developer.adzuna.com/signup",
    quotaPeriod: "today",
    attribution: "Jobs by Adzuna",
    // Its terms: "Adzuna" on each displayed advert, at least 116 × 23 px, linked to adzuna.co.uk or the local site.
    attributionLink: { home: "https://www.adzuna.co.uk", local: /^www\.adzuna\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/ },
    countries: ["at", "au", "be", "br", "ca", "ch", "de", "es", "fr", "gb", "in", "it", "mx", "nl", "nz", "pl", "sg", "us", "za"],
  },
};

/** Sources that can't be searched any more, named for the postings and searches kept from them. */
const REMOVED_SOURCE_NAMES: Record<Exclude<PostingSource, JobSource>, string> = {
  ARBEITSAGENTUR: "Bundesagentur für Arbeit",
};

/** A source's name, for a posting or search from it. */
export function sourceName(source: PostingSource): string {
  return isJobSource(source) ? SOURCE_INFO[source].name : REMOVED_SOURCE_NAMES[source];
}

/** Whether a source lists jobs in a country ("de"). */
export function sourceCovers(source: JobSource, country: string): boolean {
  const countries = SOURCE_INFO[source].countries;
  return countries === null || countries.includes(country);
}

/** Where a posting's attribution links (www.adzuna.de for one of Adzuna's German postings); null when it's plain text. */
export function attributionHref(source: PostingSource, postingUrl: string): string | null {
  const link = isJobSource(source) ? SOURCE_INFO[source].attributionLink : null;
  if (!link) return null;
  const host = URL.canParse(postingUrl) ? new URL(postingUrl) : null;
  return host?.protocol === "https:" && link.local.test(host.hostname) ? host.origin : link.home;
}
