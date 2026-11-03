import "server-only";

import { userDb } from "@/lib/db";

// Helpers for adding to the profile's lists, shared by the profile editor
// and the application page ("+ Add to profile").

/** The next `sort` value, so new entries go last. */
export async function nextSort(model: {
  aggregate: (args: { _max: { sort: true } }) => Promise<{ _max: { sort: number | null } }>;
}) {
  const { _max } = await model.aggregate({ _max: { sort: true } });
  return (_max.sort ?? -1) + 1;
}

/** A `sort` value before all others, so a new entry goes first (E4-9). */
export async function firstSort(model: {
  aggregate: (args: { _min: { sort: true } }) => Promise<{ _min: { sort: number | null } }>;
}) {
  const { _min } = await model.aggregate({ _min: { sort: true } });
  return (_min.sort ?? 1) - 1;
}

/** Finds one of the current user's skills by name, ignoring case (citext), or creates it. */
export async function findOrCreateSkill(name: string) {
  const db = await userDb();
  const existing = await db.skill.findUnique({ where: { userId_name: { userId: db.$userId, name } } });
  if (existing) return { skill: { id: existing.id, name: existing.name }, added: false };
  const created = await db.skill.create({ data: { name, sort: await nextSort(db.skill) } });
  return { skill: { id: created.id, name: created.name }, added: true };
}
