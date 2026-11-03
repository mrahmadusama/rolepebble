"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { action, ActionError } from "@/lib/action";
import { cancelApplicationJobs } from "@/lib/jobs/runner";
import { userDb } from "@/lib/db";

// Archiving and deleting an application (E9-5, LST-8), from its page, a
// card or a table row.

const GONE = "That application no longer exists.";

// The list, the dashboard and the application all show it.
const refreshEverything = () => revalidatePath("/", "layout");

/**
 * Archives an application, or brings it back. Archived ones leave the board
 * but still count on the dashboard. Tidying up isn't news, so "Updated"
 * stays as it was.
 */
export const setArchived = action(z.object({ id: z.string().min(1), archived: z.boolean() }), async ({ id, archived }) => {
  const current = await (await userDb()).application.findUnique({ where: { id }, select: { updatedAt: true } });
  if (!current) throw new ActionError(GONE);
  await (await userDb()).application.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null, updatedAt: current.updatedAt },
  });
  refreshEverything();
  return null;
});

/**
 * Deletes an application with its documents and their versions, chat,
 * notes, status history and background jobs, whose inputs and results hold
 * the posting and the documents too (the database cascades).
 */
export const deleteApplication = action(z.object({ id: z.string().min(1) }), async ({ id }) => {
  // Whose it is comes first: the job runner cancels by application id alone.
  const db = await userDb();
  if (!(await db.application.count({ where: { id } }))) throw new ActionError(GONE);
  await cancelApplicationJobs(id);
  const { count } = await db.application.deleteMany({ where: { id } });
  if (count === 0) throw new ActionError(GONE);
  refreshEverything();
  return null;
});
