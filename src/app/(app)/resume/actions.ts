"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { action, ActionError } from "@/lib/action";
import { userDbSync } from "@/lib/db";
import { DEFAULT_BASE_THEME } from "@/lib/settings";
import { loadSettings, saveSettings } from "@/lib/settings-data";
import { THEME_FIELDS } from "@/lib/theme-data";
import { parseThemeFile, themeFieldsSchema } from "@/lib/theme-file";
import type { ThemeData } from "@/lib/themes";

const THEME_GONE = "That theme doesn't exist anymore. Reload the page to see your themes.";

/** The signed-in user's data: every handler here runs inside action(), which names them. */
const db = () => userDbSync();

/** Makes a theme the base resume theme (RES-2). */
export const setBaseTheme = action(z.object({ id: z.string().min(1) }), async ({ id }) => {
  const theme = await db().theme.findUnique({ where: { id }, select: { id: true } });
  if (!theme) throw new ActionError(THEME_GONE);
  await saveSettings({ baseThemeId: id });
  revalidatePath("/resume");
  return null;
});

/**
 * Saves the theme builder's draft (RES-3, RES-4) and makes it the base
 * theme: a new custom theme without an id, or an existing custom theme
 * edited in place. Built-in themes can't be changed.
 */
export const saveTheme = action(
  themeFieldsSchema.extend({ id: z.string().min(1).nullable() }),
  async ({ id, ...fields }, { toast }): Promise<ThemeData> => {
    const theme = await db().$userTransaction(async (tx) => {
      let saved: ThemeData;
      if (id) {
        const existing = await tx.theme.findUnique({ where: { id }, select: { builtIn: true } });
        if (!existing) throw new ActionError(THEME_GONE);
        if (existing.builtIn) throw new ActionError("Built-in themes can't be changed. Save it as a new theme instead.");
        saved = await tx.theme.update({ where: { id }, data: fields, select: THEME_FIELDS });
      } else {
        saved = await tx.theme.create({ data: fields, select: THEME_FIELDS });
      }
      await saveSettings({ baseThemeId: saved.id }, tx);
      return saved;
    });
    toast(`Saved “${theme.name}”. It's now your base resume theme.`);
    revalidatePath("/resume");
    return theme;
  },
);

// ─── Managing themes (E5-7, RES-8) ───────────────────────────────────────────

/** A copy of any theme, built-in or custom, as a new custom theme; it becomes the base theme. */
export const duplicateTheme = action(z.object({ id: z.string().min(1) }), async ({ id }, { toast }): Promise<ThemeData> => {
  const original = await db().theme.findUnique({ where: { id }, select: { ...THEME_FIELDS, id: false, builtIn: false } });
  if (!original) throw new ActionError(THEME_GONE);
  const copy = await db().$userTransaction(async (tx) => {
    const created = await tx.theme.create({ data: { ...original, name: `${original.name} copy`.slice(0, 60) }, select: THEME_FIELDS });
    await saveSettings({ baseThemeId: created.id }, tx);
    return created;
  });
  toast(`Made “${copy.name}”. It's now your base resume theme.`);
  revalidatePath("/resume");
  return copy;
});

/**
 * Deletes a custom theme. Documents that used it render in the base theme
 * from then on (the database drops the link); if it was the base theme,
 * Editorial takes over. Answers with the base theme after.
 */
export const deleteTheme = action(z.object({ id: z.string().min(1) }), async ({ id }, { toast }) => {
  const theme = await db().theme.findUnique({ where: { id }, select: { name: true, builtIn: true } });
  if (!theme) throw new ActionError(THEME_GONE);
  if (theme.builtIn) throw new ActionError("Built-in themes can't be deleted.");
  const baseThemeId = await db().$userTransaction(async (tx) => {
    let base = (await loadSettings()).baseThemeId;
    if (base === id) {
      base = DEFAULT_BASE_THEME;
      await saveSettings({ baseThemeId: base }, tx);
    }
    await tx.theme.delete({ where: { id } });
    return base;
  });
  toast(`Deleted “${theme.name}”.`);
  revalidatePath("/resume");
  return { baseThemeId };
});

/** A theme from an exported theme file, checked again here; it becomes the base theme. */
export const importTheme = action(z.object({ file: z.unknown() }), async ({ file }, { toast }): Promise<ThemeData> => {
  const read = parseThemeFile(file);
  if (!read.ok) throw new ActionError(read.error);
  const theme = await db().$userTransaction(async (tx) => {
    const created = await tx.theme.create({ data: read.theme, select: THEME_FIELDS });
    await saveSettings({ baseThemeId: created.id }, tx);
    return created;
  });
  toast(`Imported “${theme.name}”. It's now your base resume theme.`);
  revalidatePath("/resume");
  return theme;
});

