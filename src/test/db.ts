import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

import { OWNER_ID } from "../../prisma/seed/built-ins";

/**
 * The database for `*.db.test.ts` files: TEST_DATABASE_URL, or DATABASE_URL
 * with "_test" added to the database name. Refuses any database whose name
 * doesn't end in "_test", so tests can never wipe development data.
 */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!explicit && !base) {
    throw new Error("Database tests need DATABASE_URL or TEST_DATABASE_URL.");
  }
  const url = new URL(explicit ?? base!);
  if (!explicit) url.pathname = `${url.pathname}_test`;
  if (!url.pathname.endsWith("_test")) {
    throw new Error(`Refusing to run database tests against "${url.pathname.slice(1)}": its name must end in "_test".`);
  }
  return url.toString();
}

export function createTestClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl() }) });
}

/**
 * Empties every table, so each test starts from a blank database, except for
 * the owner account that all data belongs to until sign-in knows users.
 */
export async function resetDatabase(db: PrismaClient): Promise<void> {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const names = tables.map(({ tablename }) => `"${tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  await db.user.create({ data: { id: OWNER_ID, email: "owner@rolepebble.invalid" } });
}

/** Another account, for checking that one user's data stays out of another's. */
export async function createTestUser(db: PrismaClient, id = "other"): Promise<string> {
  await db.user.create({ data: { id, email: `${id}@rolepebble.test` } });
  return id;
}
