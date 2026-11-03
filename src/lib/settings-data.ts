import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { userDb } from "@/lib/db";
import { DEFAULT_BASE_THEME, settingsFromRows, settingValue, type SettingsData } from "@/lib/settings";

/**
 * The current user's settings. Nothing in the database ties the base theme
 * setting to its theme, so a deleted custom theme reads as Editorial here.
 */
export async function loadSettings(): Promise<SettingsData> {
  const db = await userDb();
  const settings = settingsFromRows(await db.setting.findMany());
  if (settings.baseThemeId !== DEFAULT_BASE_THEME) {
    const theme = await db.theme.findUnique({ where: { id: settings.baseThemeId }, select: { id: true } });
    if (!theme) return { ...settings, baseThemeId: DEFAULT_BASE_THEME };
  }
  return settings;
}

/**
 * Saves the current user's given settings together; null removes one, so it
 * reads as not set. Pass a transaction client (`$userTransaction`) to save
 * them as part of that transaction.
 */
export async function saveSettings(changes: Partial<SettingsData>, tx?: Prisma.TransactionClient): Promise<void> {
  const db = await userDb();
  if (!tx) return db.$userTransaction((inner) => saveSettings(changes, inner));
  const userId = db.$userId;
  for (const [key, change] of Object.entries(changes)) {
    if (change === undefined) continue;
    const value = settingValue(change);
    if (value === null) await tx.setting.deleteMany({ where: { userId, key } });
    else await tx.setting.upsert({ where: { userId_key: { userId, key } }, create: { key, value }, update: { value } });
  }
}
