import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { approveAgentDraft, dismissAgentCandidate, prepareAgentDraft, restoreAgentCandidate } from "@/app/(app)/agent/actions";
import { removeJobSearch, showMorePostings, unsavePosting } from "@/app/(app)/jobs/actions";
import { removeStartupForGood, saveStartupNotes, setStartupStatus } from "@/app/(app)/startups/actions";
import { candidateData } from "@/lib/agent/candidates";
import { newPostings } from "@/lib/agent/run";
import { countAgentQueue } from "@/lib/agent/view";
import { runAsUser } from "@/lib/db";
import { OWNER_ID } from "@/lib/db/owner";
import { scopedDb } from "@/lib/db/scoped";
import type { FoundPosting } from "@/lib/job-search/search";
import { saveScore } from "@/lib/posting-scores";
import { countSearches, listSearches, loadSearch } from "@/lib/posting-searches";
import { countPostings, listPostings, postingStates, savePosting } from "@/lib/postings";
import { placeOf } from "@/lib/startups/place";
import { blockHashes, getStartup, listStartups, upsertStartups } from "@/lib/startups/store";
import { startupFilterSchema, type FoundStartup } from "@/lib/startups/types";
import { createTestClient, createTestUser, resetDatabase } from "@/test/db";

// Phase 2, step 5: what one user keeps from Find jobs, the job agent and
// Startups stays theirs. The owner has a saved posting, a search, a score,
// an agent find and startups; a second user, signed in, must see none of it
// and change none of it, and can keep the same postings and startups too.

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/profile-data", () => ({
  loadProfile: async () => ({ basics: { headline: "Product designer", summary: "", city: "Berlin", country: "Germany" }, skills: [], experience: [] }),
}));
// Whose session it is: sign-in only knows the owner until Phase 2's PR 10.
const signedIn = vi.hoisted(() => ({ userId: "owner" }));
vi.mock("@/lib/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/context")>()),
  sessionUserId: () => signedIn.userId,
}));

const posting: FoundPosting = {
  source: "JSEARCH",
  externalId: "job-1",
  title: "Product Designer",
  company: "Ledgerly",
  place: "Berlin",
  remote: false,
  salary: "",
  postedAt: "2026-10-28T00:00:00.000Z",
  url: "https://ledgerly.example/jobs/1",
  via: "LinkedIn",
  description: "Design our ledger tools.",
  complete: true,
};
const ref = { source: posting.source, externalId: posting.externalId };
const fit = { score: 90, reasons: ["Figma"], redFlags: [] };
const startup = (change: Partial<FoundStartup> = {}): FoundStartup => ({
  source: "HN",
  externalId: "1",
  company: "Acme",
  website: "https://acme.io",
  summary: "Design tools",
  details: "Acme | Product Designer | Berlin, Germany",
  location: "Berlin, Germany",
  remote: false,
  stage: "",
  roles: ["Product Designer"],
  emails: [],
  links: [],
  postedAt: "2026-10-20T12:00:00Z",
  ...change,
});
const berlin = placeOf({ city: "Berlin", country: "Germany" });
const everyStartup = startupFilterSchema.parse({});

const prisma = () => db.client!;
let other: string;
let ids: { posting: string; search: string; candidate: string; dismissed: string; startup: string };

beforeEach(async () => {
  await resetDatabase(prisma());
  other = await createTestUser(prisma());
  signedIn.userId = OWNER_ID;

  // The owner's finds, kept as the owner.
  const saved = await runAsUser(OWNER_ID, async () => {
    const kept = await savePosting(posting);
    await saveScore(posting, fit, "score-posting@1");
    await upsertStartups([startup(), startup({ externalId: "2", company: "Blocked Co", website: "https://blocked.io" })]);
    return kept;
  });
  const owner = scopedDb(OWNER_ID, prisma());
  const search = await owner.postingSearch.create({ data: { source: "JSEARCH", query: {}, postings: [posting], found: 1, next: "page-2" } });
  // A draft the agent prepared, waiting for review, and a find dismissed before it had one.
  const draft = await owner.application.create({ data: { company: "Ledgerly", role: "Product Designer", awaitingReview: true } });
  const candidate = await owner.agentCandidate.create({
    data: { ...candidateData({ ...posting, externalId: "job-2", url: "https://ledgerly.example/jobs/2" }, fit), status: "DRAFTED", application: { connect: { id: draft.id } } },
  });
  const dismissed = await owner.agentCandidate.create({
    data: { ...candidateData({ ...posting, externalId: "job-3", url: "https://ledgerly.example/jobs/3" }, fit), status: "DISMISSED", description: "" },
  });
  const blocked = await owner.startup.findFirstOrThrow({ where: { externalId: "2" } });
  await owner.startupBlock.createMany({ data: blockHashes({ source: "HN", externalId: "2", website: blocked.website, company: blocked.company }).map((hash) => ({ hash })) });
  await owner.startup.delete({ where: { id: blocked.id } });
  const acme = await owner.startup.findFirstOrThrow({ where: { externalId: "1" } });
  ids = { posting: saved.id, search: search.id, candidate: candidate.id, dismissed: dismissed.id, startup: acme.id };
});
afterAll(() => prisma().$disconnect());

describe("another user's Find jobs", () => {
  it("lists, counts and scores none of the owner's", async () => {
    await runAsUser(other, async () => {
      expect(await listPostings("saved")).toEqual([]);
      expect(await countPostings()).toEqual({ saved: 0, dismissed: 0 });
      expect(await listSearches()).toEqual([]);
      expect(await countSearches()).toBe(0);
      expect(await loadSearch()).toBeNull();
      expect(await loadSearch(ids.search)).toBeNull();
      expect((await postingStates([posting])).get("JSEARCH:job-1")).toMatchObject({ postingId: null, saved: false, score: null });
    });
    await runAsUser(OWNER_ID, async () => {
      expect((await postingStates([posting])).get("JSEARCH:job-1")).toMatchObject({ postingId: ids.posting, saved: true, score: { score: 90 } });
    });
  });

  it("keeps their own copy of the same posting and score", async () => {
    const theirs = await runAsUser(other, async () => {
      const kept = await savePosting(posting);
      await saveScore(posting, { score: 20, reasons: [], redFlags: [] }, "score-posting@1");
      return kept;
    });
    expect(theirs.id).not.toBe(ids.posting);
    expect(await runAsUser(other, async () => (await postingStates([posting])).get("JSEARCH:job-1"))).toMatchObject({ postingId: theirs.id, score: { score: 20 } });
    expect(await runAsUser(OWNER_ID, async () => (await postingStates([posting])).get("JSEARCH:job-1"))).toMatchObject({ postingId: ids.posting, score: { score: 90 } });
  });

  it("changes nothing of the owner's through its actions", async () => {
    signedIn.userId = other;
    expect(await unsavePosting(ref)).toMatchObject({ ok: true });
    expect(await showMorePostings({ searchId: ids.search })).toMatchObject({ ok: true, data: { ok: false, problem: "changed" } });
    expect(await removeJobSearch({ id: ids.search })).toMatchObject({ ok: true });

    expect(await prisma().posting.findUniqueOrThrow({ where: { id: ids.posting } })).toMatchObject({ savedAt: expect.any(Date) });
    expect(await prisma().postingSearch.count({ where: { id: ids.search } })).toBe(1);
  });
});

describe("another user's job agent", () => {
  it("sees none of the owner's finds, and finds the same posting new", async () => {
    const owners = { ...posting, externalId: "job-2", url: "https://ledgerly.example/jobs/2" };
    expect(await runAsUser(OWNER_ID, () => countAgentQueue())).toBe(1);
    expect(await runAsUser(other, () => countAgentQueue())).toBe(0);
    expect(await runAsUser(other, () => newPostings([owners]))).toEqual([owners]);
    expect(await runAsUser(OWNER_ID, () => newPostings([owners]))).toEqual([]);
  });

  it("can't draft, approve, dismiss or restore the owner's find", async () => {
    signedIn.userId = other;
    expect(await prepareAgentDraft({ candidateId: ids.candidate })).toMatchObject({ ok: false });
    expect(await approveAgentDraft({ candidateId: ids.candidate })).toMatchObject({ ok: false });
    expect(await dismissAgentCandidate({ candidateId: ids.candidate })).toMatchObject({ ok: false });
    expect(
      await restoreAgentCandidate({
        id: ids.dismissed,
        place: "Taken",
        remote: null,
        salary: "",
        postedAt: null,
        url: "",
        via: "",
        description: "Taken",
        complete: true,
        reasons: null,
        redFlags: null,
      }),
    ).toMatchObject({ ok: true });

    expect(await prisma().agentCandidate.findUniqueOrThrow({ where: { id: ids.candidate } })).toMatchObject({ status: "DRAFTED", applicationId: expect.any(String) });
    expect(await prisma().agentCandidate.findUniqueOrThrow({ where: { id: ids.dismissed } })).toMatchObject({ status: "DISMISSED", description: "" });
    expect(await prisma().application.count({ where: { awaitingReview: true } })).toBe(1);
    // Nothing of the owner's find was copied into theirs, and no work started.
    expect(await prisma().posting.count({ where: { userId: other } })).toBe(0);
    expect(await prisma().job.count()).toBe(0);
  });
});

describe("another user's Startups", () => {
  it("lists none of the owner's, and changes none of them", async () => {
    await runAsUser(other, async () => {
      expect((await listStartups(everyStartup, berlin)).total).toBe(0);
      expect(await getStartup(ids.startup)).toBeNull();
    });
    signedIn.userId = other;
    expect(await setStartupStatus({ id: ids.startup, status: "DISMISSED" })).toMatchObject({ ok: false });
    expect(await saveStartupNotes({ id: ids.startup, notes: "Taken" })).toMatchObject({ ok: false });
    expect(await removeStartupForGood({ id: ids.startup })).toMatchObject({ ok: false });

    expect(await prisma().startup.findUniqueOrThrow({ where: { id: ids.startup } })).toMatchObject({ status: "NEW", notes: "" });
    expect(await prisma().startupBlock.count({ where: { userId: other } })).toBe(0);
  });

  it("keeps their own copy of the same startups, and only the owner's are blocked for the owner", async () => {
    const found = [startup(), startup({ externalId: "2", company: "Blocked Co", website: "https://blocked.io" })];
    expect(await runAsUser(other, () => upsertStartups(found))).toBe(2);
    expect(await runAsUser(OWNER_ID, () => upsertStartups(found))).toBe(0);
    expect(await prisma().startup.count({ where: { userId: other } })).toBe(2);
    expect(await prisma().startup.count({ where: { userId: OWNER_ID } })).toBe(1);
  });
});
