import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { json, stubFetch } from "@/lib/ai/test-http";
import { clearJobSearchCache } from "@/lib/job-search/cache";
import { fullText } from "@/lib/job-search/find";
import { EMPTY_QUERY } from "@/lib/job-search/search";
import { savePosting } from "@/lib/postings";
import { encryptSecret, JOB_SOURCE_KEY } from "@/lib/secrets";
import { saveSettings } from "@/lib/settings-data";
import { createTestClient, resetDatabase } from "@/test/db";
import { jsearchV2LastPage, jsearchV2Page } from "@/test/job-search-fixtures";

import { countSearches, listSearches, loadSearch, removeSearch, runSearch, showMoreFor } from "./posting-searches";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
vi.mock("@/lib/env", () => ({ env: { DOSSIER_SECRET: "a".repeat(32) } }));
const prisma = () => db.client!;

const query = { ...EMPTY_QUERY, keywords: "product designer", place: "Hamburg", country: "de" };
const useJSearch = () => saveSettings({ jobSource: "JSEARCH", jsearchKeyEnc: encryptSecret(JOB_SOURCE_KEY, "ak_test") });

beforeEach(async () => {
  await resetDatabase(prisma());
  clearJobSearchCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
afterAll(() => prisma().$disconnect());

describe("runSearch", () => {
  it("is off until a source is chosen, and needs a country and a key", async () => {
    expect(await runSearch(query)).toEqual({ ok: false, problem: "off", message: "Choose where to search in Settings → Job search first." });
    await saveSettings({ jobSource: "JSEARCH" });
    expect(await runSearch({ ...query, country: "" })).toMatchObject({ ok: false, problem: "no-country" });
    expect(await runSearch(query)).toEqual({ ok: false, problem: "no-key", message: "Add your JSearch key in Settings → Job search first." });
    expect(await countSearches()).toBe(0);
  });

  it("keeps the search with its first page", async () => {
    await useJSearch();
    const requests = stubFetch(() => json(jsearchV2Page));
    const result = await runSearch(query);
    expect(result).toEqual({ ok: true, id: expect.any(String) });
    expect(requests[0].headers.get("x-api-key")).toBe("ak_test");
    const kept = await prisma().postingSearch.findUniqueOrThrow({ where: { id: result.ok ? result.id : "" } });
    expect(kept).toMatchObject({ source: "JSEARCH", query, found: 2, next: "cursor:CURSOR-PAGE-2" });
  });

  it("keeps nothing when the source says no", async () => {
    await useJSearch();
    stubFetch(() => json({}, { status: 429 }));
    expect(await runSearch(query)).toMatchObject({ ok: false, problem: "quota" });
    expect(await countSearches()).toBe(0);
  });

  it("treats a request that fails as the source not answering", async () => {
    await useJSearch();
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(() => {
      throw new Error("boom");
    });
    expect(await runSearch(query)).toMatchObject({ ok: false, problem: "unavailable" });
  });
});

describe("loadSearch", () => {
  it("opens a kept search without asking the source, with where each posting stands now", async () => {
    await useJSearch();
    stubFetch(() => json(jsearchV2Page));
    const run = await runSearch(query);
    const requests = stubFetch(() => json(jsearchV2Page));

    const now = new Date();
    const search = await loadSearch(run.ok ? run.id : "", { now });
    expect(requests).toHaveLength(0);
    expect(search).toMatchObject({ source: "JSEARCH", query, next: "cursor:CURSOR-PAGE-2", ranAt: expect.stringMatching(/^today at \d\d:\d\d$/) });
    expect(search!.postings.map((posting) => [posting.title, posting.state.saved])).toEqual([
      ["Senior Product Designer, Payments", false],
      ["UX Researcher", false],
    ]);

    const { state, ...ledgerly } = search!.postings[0];
    void state;
    await savePosting(ledgerly);
    expect((await loadSearch(search!.id))!.postings[0].state.saved).toBe(true);
  });

  it("opens the latest search without an id, and nothing when there's none or it's gone", async () => {
    expect(await loadSearch()).toBeNull();
    await prisma().postingSearch.create({ data: { source: "JSEARCH", query, postings: [], createdAt: new Date("2026-10-01T10:00:00Z") } });
    const latest = await prisma().postingSearch.create({ data: { source: "JSEARCH", query: { ...query, keywords: "researcher" }, postings: [] } });
    expect((await loadSearch())?.id).toBe(latest.id);
    expect(await loadSearch("gone")).toBeNull();
  });

  it("reads past an old posting that no longer fits, and a damaged search", async () => {
    const search = await prisma().postingSearch.create({
      data: { source: "ADZUNA", query: { keywords: 1 }, postings: [{ title: "No id" }, ...jsearchV2LastPage.data.jobs.map(() => ({ ...EMPTY_POSTING }))] },
      select: { id: true },
    });
    expect(await loadSearch(search.id, { now: new Date() })).toMatchObject({ query: EMPTY_QUERY, postings: [expect.objectContaining({ externalId: "kept" })] });
    await prisma().postingSearch.update({ where: { id: search.id }, data: { postings: { not: "a list" } } });
    expect((await loadSearch(search.id))!.postings).toEqual([]);
  });

  it("says when it ran: yesterday, or the day", async () => {
    const yesterday = await prisma().postingSearch.create({ data: { source: "JSEARCH", query, postings: [], createdAt: new Date("2026-10-02T16:20:00Z") } });
    const older = await prisma().postingSearch.create({ data: { source: "JSEARCH", query, postings: [], createdAt: new Date("2026-09-28T08:05:00Z") } });
    const now = new Date("2026-10-03T12:00:00Z");
    expect((await loadSearch(yesterday.id, { timeZone: "Europe/Berlin", now }))!.ranAt).toBe("yesterday at 18:20");
    expect((await loadSearch(older.id, { timeZone: "Europe/Berlin", now }))!.ranAt).toBe("on Mon 28 Sep at 10:05");
  });
});

const EMPTY_POSTING = {
  source: "JSEARCH",
  externalId: "kept",
  title: "Kept",
  company: "",
  place: "",
  remote: null,
  salary: "",
  postedAt: null,
  url: "",
  via: "",
  description: "",
  complete: false,
};

describe("showMoreFor", () => {
  it("adds the next page to the kept search, once each, from the search's own source", async () => {
    await useJSearch();
    stubFetch(() => json(jsearchV2Page));
    const run = await runSearch(query);
    const id = run.ok ? run.id : "";
    // The user switched sources meanwhile: the search goes on with its own.
    await saveSettings({ jobSource: "ADZUNA" });

    const requests = stubFetch(() => json(jsearchV2LastPage));
    const more = await showMoreFor(id);
    expect(requests[0].url.searchParams.get("cursor")).toBe("CURSOR-PAGE-2");
    // UX Researcher was on the first page already.
    expect(more).toEqual({ ok: true, postings: [], next: null });
    expect(await prisma().postingSearch.findUniqueOrThrow({ where: { id } })).toMatchObject({ found: 2, next: null });

    // The last page: nothing more to ask.
    expect(await showMoreFor(id)).toEqual({ ok: true, postings: [], next: null });
    expect(requests).toHaveLength(1);
  });

  it("adds new postings with where they stand", async () => {
    await useJSearch();
    stubFetch(() => json(jsearchV2LastPage));
    const run = await runSearch({ ...query, keywords: "researcher" });
    const id = run.ok ? run.id : "";
    await prisma().postingSearch.update({ where: { id }, data: { next: "cursor:MORE" } });
    stubFetch(() => json(jsearchV2Page));
    const more = await showMoreFor(id);
    expect(more).toMatchObject({ ok: true, next: "cursor:CURSOR-PAGE-2", postings: [expect.objectContaining({ title: "Senior Product Designer, Payments", state: expect.objectContaining({ saved: false }) })] });
    expect((await prisma().postingSearch.findUniqueOrThrow({ where: { id } })).found).toBe(2);
  });

  it("says when the search is gone, or the source says no", async () => {
    expect(await showMoreFor("gone")).toMatchObject({ ok: false, message: "That search is no longer kept. Search again." });
    await useJSearch();
    stubFetch(() => json(jsearchV2Page));
    const run = await runSearch(query);
    stubFetch(() => json({}, { status: 429 }));
    expect(await showMoreFor(run.ok ? run.id : "")).toMatchObject({ ok: false, problem: "quota" });
  });

  it("never goes on with a search kept from a source since removed", async () => {
    const posting = { ...EMPTY_POSTING, source: "ARBEITSAGENTUR" as const, externalId: "10001-1", title: "Softwareentwickler" };
    const search = await prisma().postingSearch.create({ data: { source: "ARBEITSAGENTUR", query, postings: [posting], found: 1, next: "page:2" } });
    const requests = stubFetch(() => json({}));
    expect(await loadSearch(search.id)).toMatchObject({ source: "ARBEITSAGENTUR", next: null, postings: [expect.objectContaining({ title: "Softwareentwickler" })] });
    expect(await showMoreFor(search.id)).toEqual({ ok: true, postings: [], next: null });
    expect(await fullText(posting)).toBeNull();
    expect(requests).toHaveLength(0);
  });
});

describe("listSearches and removeSearch", () => {
  it("lists kept searches newest first, grouped by the day they ran in the user's time zone", async () => {
    const at = (iso: string, keywords: string) =>
      prisma().postingSearch.create({ data: { source: "JSEARCH", query: { ...query, keywords }, postings: [], found: 3, createdAt: new Date(iso) } });
    await at("2026-10-03T09:30:00Z", "designer");
    await at("2026-10-02T22:30:00Z", "researcher"); // Already the 3rd in Berlin.
    await at("2026-10-02T10:00:00Z", "writer");
    await at("2026-09-28T08:00:00Z", "nurse");

    const days = await listSearches({ timeZone: "Europe/Berlin", now: new Date("2026-10-03T12:00:00Z") });
    expect(days.map((day) => [day.day, day.searches.map((search) => [search.time, search.query.keywords, search.found])])).toEqual([
      ["Today", [["11:30", "designer", 3], ["00:30", "researcher", 3]]],
      ["Yesterday", [["12:00", "writer", 3]]],
      ["Mon 28 Sep", [["10:00", "nurse", 3]]],
    ]);
    expect(await countSearches()).toBe(4);
  });

  it("removes a search, and leaves saved postings alone", async () => {
    const search = await prisma().postingSearch.create({ data: { source: "JSEARCH", query, postings: [EMPTY_POSTING] } });
    await savePosting({ ...EMPTY_POSTING, source: "JSEARCH" });
    await removeSearch(search.id);
    await removeSearch("gone");
    expect(await countSearches()).toBe(0);
    expect(await prisma().posting.count()).toBe(1);
  });
});

describe("fullText", () => {
  it("returns a complete posting's own text, and asks the posting's own source for the rest", async () => {
    await useJSearch();
    stubFetch(() => json(jsearchV2Page));
    const run = await runSearch(query);
    const { state, ...posting } = (await loadSearch(run.ok ? run.id : ""))!.postings[0];
    void state;
    expect(await fullText(posting)).toBe(posting.description);
    expect(await fullText({ ...posting, complete: false })).toBe(posting.description);
  });

  it("gives up quietly without the source's key", async () => {
    expect(await fullText({ ...EMPTY_POSTING, source: "JSEARCH", complete: false })).toBeNull();
  });
});
