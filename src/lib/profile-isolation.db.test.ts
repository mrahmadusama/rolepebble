import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { addSkill, removeSkill, saveBasics, saveExperience } from "@/app/(app)/profile/actions";
import { deleteTheme, setBaseTheme } from "@/app/(app)/resume/actions";
import { runAsUser } from "@/lib/db";
import { OWNER_ID } from "@/lib/db/owner";
import { scopedDb } from "@/lib/db/scoped";
import { saveFact } from "@/lib/fact-actions";
import { loadFacts, loadProfile, loadProfileName } from "@/lib/profile-data";
import { findOrCreateSkill } from "@/lib/profile-entries";
import { applyImportedProfile } from "@/lib/profile-import-apply";
import { loadSettings, saveSettings } from "@/lib/settings-data";
import { loadThemes } from "@/lib/theme-data";
import { createTestClient, createTestUser, resetDatabase } from "@/test/db";

import { seedBuiltIns } from "../../prisma/seed/built-ins";

// Phase 2, step 3: one user's profile, facts, themes and settings stay theirs.
// The owner has a profile; a second user, signed in, must see none of it and
// change none of it.

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Whose session it is: sign-in only knows the owner until Phase 2's PR 10.
const signedIn = vi.hoisted(() => ({ userId: "owner" }));
vi.mock("@/lib/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/context")>()),
  sessionUserId: () => signedIn.userId,
}));

const prisma = () => db.client!;
let other: string;
let ids: { experience: string; skill: string; fact: string; theme: string };

beforeEach(async () => {
  await resetDatabase(prisma());
  await seedBuiltIns(prisma());
  other = await createTestUser(prisma());
  signedIn.userId = OWNER_ID;

  // The owner's profile, written as the owner.
  const owner = scopedDb(OWNER_ID, prisma());
  await owner.profileField.create({ data: { key: "name", value: "Jane Doe" } });
  const skill = await owner.skill.create({ data: { name: "Figma" } });
  const experience = await owner.experience.create({ data: { role: "Designer", company: "Northwind" } });
  const fact = await owner.fact.create({ data: { text: "Ran the design system" } });
  const theme = await owner.theme.create({ data: { name: "Mine", headFont: "NEWSREADER", bodyFont: "GEIST", accent: "#7a3b2e" } });
  await runAsUser(OWNER_ID, () => saveSettings({ paper: "LETTER", baseThemeId: theme.id }));
  ids = { experience: experience.id, skill: skill.id, fact: fact.id, theme: theme.id };
});
afterAll(() => prisma().$disconnect());

describe("another user's profile, facts, themes and settings", () => {
  it("reads none of the owner's", async () => {
    await runAsUser(other, async () => {
      expect(await loadProfileName()).toBe("");
      const profile = await loadProfile();
      expect(profile.skills).toEqual([]);
      expect(profile.experience).toEqual([]);
      expect(profile.facts).toEqual([]);
      expect(await loadFacts(null)).toEqual([]);
      expect(await loadSettings()).toMatchObject({ paper: "A4", baseThemeId: "editorial" });
      // The built-in themes, and none of the owner's own.
      expect((await loadThemes()).every((theme) => theme.builtIn)).toBe(true);
    });
    // The owner still has theirs.
    await runAsUser(OWNER_ID, async () => {
      expect(await loadProfileName()).toBe("Jane Doe");
      expect(await loadSettings()).toMatchObject({ paper: "LETTER", baseThemeId: ids.theme });
    });
  });

  it("keeps settings and skill names apart: both can have the same ones", async () => {
    await runAsUser(other, () => saveSettings({ paper: "A4", strict: false }));
    const theirs = await runAsUser(other, () => findOrCreateSkill("figma"));
    expect(theirs.added).toBe(true);
    expect(theirs.skill.id).not.toBe(ids.skill);
    expect(await runAsUser(OWNER_ID, () => loadSettings())).toMatchObject({ paper: "LETTER", strict: true });
  });

  it("changes nothing of the owner's through the profile, fact and theme actions", async () => {
    signedIn.userId = other;
    await saveBasics({
      name: "Sam",
      headline: "",
      email: "",
      phone: "",
      dob: "",
      website: "",
      address: "",
      city: "",
      country: "",
      linkedin: "",
      summary: "",
      showAge: false,
    });
    await saveExperience({
      id: ids.experience,
      role: "Taken",
      company: "",
      location: "",
      descriptor: "",
      bullets: "",
      startYear: null,
      startMonth: null,
      endYear: null,
      endMonth: null,
      current: false,
    });
    await removeSkill({ id: ids.skill });
    await saveFact({ id: ids.fact, text: "Taken" });
    expect(await setBaseTheme({ id: ids.theme })).toMatchObject({ ok: false });
    expect(await deleteTheme({ id: ids.theme })).toMatchObject({ ok: false });
    expect((await addSkill({ name: "Figma" })).ok).toBe(true);

    const owner = scopedDb(OWNER_ID, prisma());
    expect(await owner.experience.findUniqueOrThrow({ where: { id: ids.experience } })).toMatchObject({ role: "Designer" });
    expect(await owner.skill.findUnique({ where: { id: ids.skill } })).not.toBeNull();
    expect(await owner.fact.findUniqueOrThrow({ where: { id: ids.fact } })).toMatchObject({ text: "Ran the design system" });
    expect(await owner.theme.findUnique({ where: { id: ids.theme } })).not.toBeNull();
    expect(await runAsUser(OWNER_ID, () => loadProfileName())).toBe("Jane Doe");
    // What they saved is theirs.
    expect(await runAsUser(other, () => loadProfileName())).toBe("Sam");
  });

  it("replaces only their own profile when importing a resume", async () => {
    await runAsUser(other, () =>
      applyImportedProfile(
        scopedDb(other, prisma()),
        {
          basics: { name: "Sam" },
          skills: [{ name: "Research", found: true }],
          languages: [],
          experience: [],
          projects: [],
          education: [],
          publications: [],
          references: [],
        },
        "replace",
      ),
    );
    const owner = scopedDb(OWNER_ID, prisma());
    expect(await owner.skill.count()).toBe(1);
    expect(await owner.experience.count()).toBe(1);
    expect(await runAsUser(other, async () => (await loadProfile()).skills.map((skill) => skill.name))).toEqual(["Research"]);
  });
});
