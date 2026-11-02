import type { PrismaClient } from "@/generated/prisma/client";
import { BUILT_IN_THEMES } from "@/lib/themes";

/** The account all data belongs to until sign-in knows users (Phase 2). */
export const OWNER_ID = "owner";

/**
 * Creates what every installation needs: the owner account and the built-in
 * themes. Safe to run on every start: the themes are kept in sync with
 * BUILT_IN_THEMES (src/lib/themes.ts). An empty profile and default settings
 * need no rows.
 */
export async function seedBuiltIns(db: PrismaClient): Promise<void> {
  await db.$transaction([
    db.user.upsert({ where: { id: OWNER_ID }, create: { id: OWNER_ID, email: "owner@rolepebble.invalid" }, update: {} }),
    // Built-in themes belong to no one.
    ...BUILT_IN_THEMES.map(({ id, ...theme }) =>
      db.theme.upsert({ where: { id }, create: { id, ...theme, userId: null }, update: theme }),
    ),
  ]);
}
