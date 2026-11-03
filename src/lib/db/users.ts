import "server-only";

import { logServerError } from "@/lib/log";
import { prisma } from "@/lib/prisma";

import { runAsUser } from "./context";

/**
 * Runs `fn` as each user in turn (`runAsUser`), for the timers that work on
 * everyone's data. One user's failure is logged under `label` and doesn't
 * stop the rest.
 */
export async function forEachUser(label: string, fn: () => Promise<unknown>): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });
  for (const { id } of users) {
    await runAsUser(id, fn).catch((error: unknown) => logServerError(label, error));
  }
}
