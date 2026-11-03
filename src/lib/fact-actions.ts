"use server";

import { z } from "zod";

import { action, ActionError } from "@/lib/action";
import { userDbSync } from "@/lib/db";
import { nextSort } from "@/lib/profile-entries";

// Facts the user tells the AI (PRO-14, APP-15): the profile's own when
// applicationId is null, else one application's. Added blank, autosaved as
// typed, removed at once with Undo.

const id = z.string().min(1);
const applicationId = id.nullable();
/** About a short paragraph: a fact, not a document. */
const text = z.string().max(1000);
/** Plenty for one person or one application, and still a prompt a local model can take. */
const MAX_FACTS = 50;

/** The signed-in user's data: these run inside action(), which names them. */
const db = () => userDbSync();

async function checkRoom(applicationId: string | null) {
  if (applicationId && !(await db().application.findUnique({ where: { id: applicationId }, select: { id: true } }))) {
    throw new ActionError("This application doesn't exist any more.");
  }
  if ((await db().fact.count({ where: { applicationId } })) >= MAX_FACTS) {
    throw new ActionError(`That's ${MAX_FACTS} facts already. Remove one you no longer need first.`);
  }
}

export const createFact = action(z.object({ applicationId }), async ({ applicationId }) => {
  await checkRoom(applicationId);
  return db().fact.create({ data: { applicationId, sort: await nextSort(db().fact) }, select: { id: true, text: true } });
});

export const saveFact = action(z.object({ id, text }), async ({ id, text }) => {
  await db().fact.updateMany({ where: { id }, data: { text } });
  return null;
});

/** Answers with where it was, for Undo. */
export const removeFact = action(z.object({ id }), async ({ id }) => {
  const fact = await db().fact.findUnique({ where: { id }, select: { sort: true } });
  await db().fact.deleteMany({ where: { id } });
  return { sort: fact?.sort ?? null };
});

/** Undo: back with its id and text, in its old place when that's known. */
export const restoreFact = action(
  z.object({ id, applicationId, text, sort: z.number().int().nullable() }),
  async ({ id, applicationId, text, sort }) => {
    await checkRoom(applicationId);
    return db().fact.upsert({
      where: { id },
      create: { id, applicationId, text, sort: sort ?? (await nextSort(db().fact)) },
      update: {},
      select: { id: true, text: true },
    });
  },
);
