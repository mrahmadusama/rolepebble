import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestUser, resetDatabase } from "@/test/db";

import { currentUserId, runAsUser, userDb, userDbSync } from "./context";
import { OWNER_ID } from "./owner";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof import("@/test/db").createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
const session = vi.hoisted(() => ({ value: null as object | null }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session.value }));

const prisma = () => db.client!;

beforeEach(async () => {
  session.value = null;
  await resetDatabase(prisma());
});
afterAll(() => prisma().$disconnect());

describe("user context", () => {
  it("works for the user runAsUser names, even across awaits", async () => {
    const other = await createTestUser(prisma());
    await runAsUser(other, async () => {
      expect(currentUserId()).toBe(other);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const client = await userDb();
      expect(client.$userId).toBe(other);
      expect(userDbSync().$userId).toBe(other);
      expect((await client.application.create({ data: { company: "Northwind" } })).userId).toBe(other);
    });
    expect(currentUserId()).toBeUndefined();
  });

  it("lets an inner runAsUser name someone else for its own work only", async () => {
    const other = await createTestUser(prisma());
    await runAsUser(OWNER_ID, async () => {
      await runAsUser(other, async () => expect((await userDb()).$userId).toBe(other));
      expect((await userDb()).$userId).toBe(OWNER_ID);
    });
  });

  it("works for the signed-in user without runAsUser: the owner, until sign-in knows users", async () => {
    session.value = { persistent: false };
    expect((await userDb()).$userId).toBe(OWNER_ID);
  });

  it("refuses when nobody is named and nobody is signed in", async () => {
    await expect(userDb()).rejects.toThrow("No user to work for");
    expect(() => userDbSync()).toThrow("not inside runAsUser");
  });
});
