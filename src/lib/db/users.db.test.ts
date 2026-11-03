import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { logServerError } from "@/lib/log";
import { createTestUser, resetDatabase } from "@/test/db";

import { currentUserId } from "./context";
import { OWNER_ID } from "./owner";
import { forEachUser } from "./users";

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof import("@/test/db").createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
vi.mock("@/lib/log", () => ({ logServerError: vi.fn() }));

const prisma = () => db.client!;

beforeEach(async () => {
  vi.mocked(logServerError).mockClear();
  await resetDatabase(prisma());
});
afterAll(() => prisma().$disconnect());

describe("forEachUser", () => {
  it("runs as each user in turn, and one user's failure doesn't stop the rest", async () => {
    await createTestUser(prisma(), "bea");
    await createTestUser(prisma(), "cai");
    const ran: (string | undefined)[] = [];
    await forEachUser("test", async () => {
      ran.push(currentUserId());
      if (currentUserId() === "bea") throw new Error("Bea's broke");
    });
    expect(ran).toEqual([OWNER_ID, "bea", "cai"]);
    expect(logServerError).toHaveBeenCalledTimes(1);
    expect(logServerError).toHaveBeenCalledWith("test", expect.objectContaining({ message: "Bea's broke" }));
  });
});
