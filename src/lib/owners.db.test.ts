import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { OWNER_ID } from "../../prisma/seed/built-ins";
import { createTestClient, createTestUser, resetDatabase } from "@/test/db";

// Phase 2, step 1 (migration 20261102120000_owners): every row has an owner,
// filled in by the database, and a row can't point at another user's rows.

const db = createTestClient();

beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const theme = { name: "Mine", headFont: "NEWSREADER", bodyFont: "GEIST", accent: "#7a3b2e" } as const;

const refusedAsAnotherUsers = (error: unknown) => String(error).includes("rp_same_owner");

describe("owners", () => {
  it("gives new rows to the owner account until the app names a user", async () => {
    const application = await db.application.create({ data: { company: "Ledgerly" } });
    const fact = await db.fact.create({ data: { text: "Ran the design system", applicationId: application.id } });
    expect(application.userId).toBe(OWNER_ID);
    expect(fact.userId).toBe(OWNER_ID);
  });

  it("gives new rows to the user the app names, nested ones included", async () => {
    const other = await createTestUser(db);
    const application = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${other}, true)`;
      return tx.application.create({
        data: { company: "Ledgerly", notes: { create: [{ body: "Call back Monday" }] } },
        include: { notes: true },
      });
    });
    expect(application.userId).toBe(other);
    expect(application.notes.map((note) => note.userId)).toEqual([other]);
    // Outside that transaction, rows go to the owner again.
    expect((await db.skill.create({ data: { name: "Figma" } })).userId).toBe(OWNER_ID);
  });

  it("refuses a row that points at another user's row", async () => {
    const other = await createTestUser(db);
    const owners = await db.application.create({ data: { company: "Ledgerly" } });
    await expect(db.fact.create({ data: { userId: other, text: "Not theirs", applicationId: owners.id } })).rejects.toSatisfy(
      refusedAsAnotherUsers,
    );
    await expect(db.note.create({ data: { userId: other, body: "Not theirs", applicationId: owners.id } })).rejects.toSatisfy(
      refusedAsAnotherUsers,
    );

    // Two parents: an experience and a skill, which must both be the row's user's.
    const othersRole = await db.experience.create({ data: { userId: other, role: "Designer" } });
    const ownersSkill = await db.skill.create({ data: { name: "Figma" } });
    await expect(
      db.experienceSkill.create({ data: { userId: other, experienceId: othersRole.id, skillId: ownersSkill.id } }),
    ).rejects.toSatisfy(refusedAsAnotherUsers);

    // Moving a row onto another user's parent is refused too.
    const othersApplication = await db.application.create({ data: { userId: other, company: "Northwind" } });
    const fact = await db.fact.create({ data: { text: "Mine", applicationId: owners.id } });
    await expect(db.fact.update({ where: { id: fact.id }, data: { applicationId: othersApplication.id } })).rejects.toSatisfy(
      refusedAsAnotherUsers,
    );
  });

  it("lets every user's documents use a built-in theme, but only their own custom ones", async () => {
    const other = await createTestUser(db);
    const builtIn = await db.theme.create({ data: { id: "editorial", builtIn: true, userId: null, ...theme } });
    const ownersTheme = await db.theme.create({ data: theme });
    expect(ownersTheme.userId).toBe(OWNER_ID);
    const application = await db.application.create({ data: { userId: other, company: "Ledgerly" } });

    const document = await db.document.create({
      data: { userId: other, applicationId: application.id, kind: "RESUME", units: [], themeId: builtIn.id },
    });
    expect(document.themeId).toBe("editorial");
    await expect(db.document.update({ where: { id: document.id }, data: { themeId: ownersTheme.id } })).rejects.toSatisfy(
      refusedAsAnotherUsers,
    );
  });

  it("keeps built-in themes ownerless and custom themes owned", async () => {
    await expect(db.theme.create({ data: { id: "classic", builtIn: true, ...theme } })).rejects.toThrow(/Theme_owner_check/);
    await expect(db.theme.create({ data: { builtIn: false, userId: null, ...theme } })).rejects.toThrow(/Theme_owner_check/);
  });

  it("deletes a user's data with their account, and nobody else's", async () => {
    const other = await createTestUser(db);
    await db.application.create({ data: { userId: other, company: "Northwind" } });
    await db.application.create({ data: { company: "Ledgerly" } });

    await db.user.delete({ where: { id: other } });
    expect(await db.application.findMany({ select: { company: true, userId: true } })).toEqual([
      { company: "Ledgerly", userId: OWNER_ID },
    ]);
  });
});
