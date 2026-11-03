import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OWNED_MODELS, SHARED_ROWS_MODELS, SYSTEM_MODELS } from "./owned-models";

// Every table is either a user's data (it has `userId`) or a system table, so
// a new table can't be left out of the scoped client by accident.

const schema = readFileSync("prisma/schema.prisma", "utf8");
const models = [...schema.matchAll(/^model (\w+) \{\n([\s\S]*?)^\}/gm)].map(([, name, body]) => ({
  name,
  owned: /^\s+userId\s+String/m.test(body),
  nullableOwner: /^\s+userId\s+String\?/m.test(body),
}));

describe("owned models", () => {
  it("lists every table with a userId as a user's data, and every other one as a system table", () => {
    expect(models.length).toBeGreaterThan(25);
    for (const { name, owned } of models) {
      if (owned) expect(OWNED_MODELS.has(name as never), `${name} has userId`).toBe(true);
      else expect(SYSTEM_MODELS.has(name as never), `${name} has no userId`).toBe(true);
    }
    expect(OWNED_MODELS.size + SYSTEM_MODELS.size).toBe(models.length);
  });

  it("shares rows without an owner only where userId may be null", () => {
    expect(models.filter((model) => model.nullableOwner).map((model) => model.name)).toEqual([...SHARED_ROWS_MODELS]);
  });
});
