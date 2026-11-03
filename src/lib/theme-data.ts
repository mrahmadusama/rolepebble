import "server-only";

import { userDb } from "@/lib/db";
import { BUILT_IN_THEMES, type ThemeData } from "@/lib/themes";

/** The columns a ThemeData needs, for `select`. */
export const THEME_FIELDS = {
  id: true,
  name: true,
  builtIn: true,
  headFont: true,
  bodyFont: true,
  accent: true,
  layout: true,
  align: true,
  headingStyle: true,
  density: true,
  headerStyle: true,
  sidebarStyle: true,
  dateStyle: true,
  photoShape: true,
  photoPosition: true,
} as const;

const builtInOrder = new Map(BUILT_IN_THEMES.map((theme, index) => [theme.id, index]));

/** Every theme the current user has: the built-ins in the picker's order, then their own, oldest first. */
export async function loadThemes(): Promise<ThemeData[]> {
  const themes = await (await userDb()).theme.findMany({ select: THEME_FIELDS, orderBy: { createdAt: "asc" } });
  const rank = (theme: ThemeData) => builtInOrder.get(theme.id) ?? builtInOrder.size;
  // Array.prototype.sort is stable, so custom themes keep their creation order.
  return themes.sort((a, b) => rank(a) - rank(b));
}

/** How many applications' documents use each theme, by theme id (E5-7). */
export async function loadThemeUsage(): Promise<Record<string, number>> {
  const uses = await (await userDb()).document.findMany({
    where: { themeId: { not: null } },
    distinct: ["applicationId", "themeId"],
    select: { themeId: true },
  });
  const usage: Record<string, number> = {};
  for (const { themeId } of uses) usage[themeId!] = (usage[themeId!] ?? 0) + 1;
  return usage;
}

/** One theme, built-in or the current user's own, or null when there's no such theme for them. */
export async function loadTheme(id: string): Promise<ThemeData | null> {
  return (await userDb()).theme.findUnique({ where: { id }, select: THEME_FIELDS });
}
