import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createTestClient, createTestUser, resetDatabase } from "@/test/db";

import { OWNER_ID } from "./owner";
import { scopedDb } from "./scoped";

// The scoped clients are built on the test database's client directly.
const db = createTestClient();

let other: string;
const mine = () => scopedDb(OWNER_ID, db);
const theirs = () => scopedDb(other, db);

beforeEach(async () => {
  await resetDatabase(db);
  other = await createTestUser(db);
});
afterAll(() => db.$disconnect());

const notFound = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
const theme = { name: "Mine", headFont: "NEWSREADER", bodyFont: "GEIST", accent: "#7a3b2e" } as const;

describe("scopedDb", () => {
  it("gives new rows to its user, nested ones included", async () => {
    const application = await theirs().application.create({
      data: { company: "Northwind", notes: { create: [{ body: "Call back" }] } },
      include: { notes: true },
    });
    expect(application.userId).toBe(other);
    expect(application.notes[0].userId).toBe(other);
    await theirs().skill.createMany({ data: [{ name: "Figma" }, { name: "Research" }] });
    expect(await db.skill.findMany({ select: { userId: true } })).toEqual([{ userId: other }, { userId: other }]);
  });

  it("refuses to write rows for another user", async () => {
    await expect(theirs().application.create({ data: { userId: OWNER_ID, company: "Ledgerly" } })).rejects.toThrow(
      "Refusing to write Application data for another user.",
    );
    const application = await theirs().application.create({ data: { company: "Northwind" } });
    await expect(
      theirs().application.updateMany({ where: { id: application.id }, data: { userId: OWNER_ID } }),
    ).rejects.toThrow("for another user");
  });

  it("only reads its user's rows", async () => {
    const owners = await mine().application.create({ data: { company: "Ledgerly" } });
    await theirs().application.create({ data: { company: "Northwind" } });

    expect((await mine().application.findMany()).map((a) => a.company)).toEqual(["Ledgerly"]);
    expect((await theirs().application.findMany()).map((a) => a.company)).toEqual(["Northwind"]);
    expect(await theirs().application.findUnique({ where: { id: owners.id } })).toBeNull();
    expect(await theirs().application.findFirst({ where: { company: "Ledgerly" } })).toBeNull();
    await expect(theirs().application.findUniqueOrThrow({ where: { id: owners.id } })).rejects.toSatisfy(notFound);
    expect(await theirs().application.count()).toBe(1);
    expect(await theirs().application.aggregate({ _count: { _all: true } })).toEqual({ _count: { _all: 1 } });
    expect(await theirs().application.groupBy({ by: ["company"], _count: { _all: true } })).toEqual([
      { company: "Northwind", _count: { _all: 1 } },
    ]);
    // Combines with the caller's own filters, including OR.
    expect(await theirs().application.count({ where: { OR: [{ company: "Ledgerly" }, { company: "Northwind" }] } })).toBe(1);
  });

  it("never changes or deletes another user's rows", async () => {
    const owners = await mine().application.create({ data: { company: "Ledgerly" } });

    await expect(theirs().application.update({ where: { id: owners.id }, data: { company: "Taken" } })).rejects.toSatisfy(notFound);
    expect(await theirs().application.updateMany({ where: { id: owners.id }, data: { company: "Taken" } })).toEqual({ count: 0 });
    await expect(theirs().application.delete({ where: { id: owners.id } })).rejects.toSatisfy(notFound);
    expect(await theirs().application.deleteMany()).toEqual({ count: 0 });

    expect(await db.application.findUniqueOrThrow({ where: { id: owners.id } })).toMatchObject({ company: "Ledgerly", userId: OWNER_ID });
  });

  it("shares built-in themes for reading, but not for changing", async () => {
    await db.theme.create({ data: { id: "editorial", builtIn: true, userId: null, ...theme } });
    await mine().theme.create({ data: theme });

    expect((await theirs().theme.findMany()).map((t) => t.id)).toEqual(["editorial"]);
    expect(await theirs().theme.findUnique({ where: { id: "editorial" } })).toMatchObject({ builtIn: true });
    expect((await mine().theme.findMany({ orderBy: { builtIn: "desc" } })).map((t) => t.builtIn)).toEqual([true, false]);
    await expect(theirs().theme.update({ where: { id: "editorial" }, data: { name: "Mine now" } })).rejects.toSatisfy(notFound);
  });

  it("runs interactive transactions as its user", async () => {
    const created = await theirs().$userTransaction(async (tx) => {
      const application = await tx.application.create({ data: { company: "Northwind" } });
      await tx.note.create({ data: { applicationId: application.id, body: "Call back" } });
      return tx.application.findMany({ include: { notes: true } });
    });
    expect(created).toHaveLength(1);
    expect(created[0].userId).toBe(other);
    expect(created[0].notes[0].userId).toBe(other);

    // Inside, only the user's rows are visible.
    await mine().application.create({ data: { company: "Ledgerly" } });
    expect(await theirs().$userTransaction((tx) => tx.application.count())).toBe(1);

    // A failure rolls everything back.
    await expect(
      theirs().$userTransaction(async (tx) => {
        await tx.application.create({ data: { company: "Gone" } });
        throw new Error("stop");
      }),
    ).rejects.toThrow("stop");
    expect(await db.application.count({ where: { company: "Gone" } })).toBe(0);
  });

  it("tells raw queries whose data they work on", async () => {
    const [row] = await theirs().$queryRaw<{ user: string }[]>`SELECT current_setting('app.user_id', true) AS "user"`;
    expect(row.user).toBe(other);
    // Outside the scoped client, nobody is named.
    const [plain] = await db.$queryRaw<{ user: string | null }[]>`SELECT current_setting('app.user_id', true) AS "user"`;
    expect(plain.user ?? "").toBe("");
  });

  it("refuses tables that aren't a user's data", async () => {
    await expect(theirs().user.findMany()).rejects.toThrow("User isn't a user's data: use the system client for it.");
    await expect(theirs().loginThrottle.count()).rejects.toThrow("LoginThrottle isn't a user's data");
  });

  it("says whose data it works on", () => {
    expect(theirs().$userId).toBe(other);
  });
});
