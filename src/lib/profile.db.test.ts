import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createTestClient, resetDatabase } from "@/test/db";
import { OWNER_ID } from "@/lib/db/owner";

const db = createTestClient();

beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

describe("profile schema", () => {
  it("keeps one value per profile key", async () => {
    await db.profileField.create({ data: { key: "name", value: "Jane Doe" } });
    await expect(db.profileField.create({ data: { key: "name", value: "Someone else" } })).rejects.toSatisfy(
      (error) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002",
    );
  });

  it("treats skill and language names as unique ignoring case", async () => {
    await db.skill.create({ data: { name: "Figma" } });
    await expect(db.skill.create({ data: { name: "figma" } })).rejects.toSatisfy(
      (error) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002",
    );
    expect(await db.skill.findUnique({ where: { userId_name: { userId: OWNER_ID, name: "FIGMA" } } })).toMatchObject({
      name: "Figma",
    });

    await db.language.create({ data: { name: "Dutch", level: "NATIVE" } });
    await expect(db.language.create({ data: { name: "DUTCH", level: "C1" } })).rejects.toThrow();
  });

  it("removes a skill's role links when the skill or the role is deleted", async () => {
    const figma = await db.skill.create({ data: { name: "Figma" } });
    const research = await db.skill.create({ data: { name: "User research" } });
    const role = await db.experience.create({
      data: {
        role: "Product Designer",
        startYear: 2018,
        startMonth: 6,
        skills: { create: [{ skillId: figma.id }, { skillId: research.id }] },
      },
    });
    const other = await db.experience.create({
      data: { role: "UX Designer", skills: { create: [{ skillId: figma.id }] } },
    });

    await db.skill.delete({ where: { id: figma.id } });
    expect(await db.experienceSkill.findMany({ select: { experienceId: true, skillId: true }, orderBy: { skillId: "asc" } })).toEqual([
      { experienceId: role.id, skillId: research.id },
    ]);

    await db.experience.delete({ where: { id: role.id } });
    expect(await db.experienceSkill.count()).toBe(0);
    expect(await db.skill.count()).toBe(1);
    expect(await db.experience.findUnique({ where: { id: other.id } })).not.toBeNull();
  });
});
