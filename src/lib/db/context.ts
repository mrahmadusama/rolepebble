import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { getSession, type Session } from "@/lib/auth/session";

import { OWNER_ID } from "./owner";
import { scopedDb, type ScopedDb } from "./scoped";

// Whose data the code running now works on. A request takes it from the
// session; work outside a request (the job runner, the schedulers) names the
// user with runAsUser. There's no default user: code that asks with neither
// fails, rather than touch someone's data by mistake.

/** The user `runAsUser` names; the client is made only when code asks for it. */
const current = new AsyncLocalStorage<string>();

// One client per user, kept for reuse: building one is cheap, but not free.
const MAX_CLIENTS = 500;
const clients = new Map<string, ScopedDb>();

function clientFor(userId: string): ScopedDb {
  let db = clients.get(userId);
  if (db) {
    clients.delete(userId); // re-inserted below: most recently used last
  } else {
    db = scopedDb(userId);
    if (clients.size >= MAX_CLIENTS) clients.delete(clients.keys().next().value!);
  }
  clients.set(userId, db);
  return db;
}

/**
 * The user a session belongs to. Until sign-in knows users (Phase 2, PR 10),
 * every session is the owner's.
 */
export function sessionUserId(session: Session): string {
  void session;
  return OWNER_ID;
}

/** Runs `fn` with `userId`'s data: `userDb()` inside it gives their client. */
export function runAsUser<T>(userId: string, fn: () => T): T {
  return current.run(userId, fn);
}

/** Whose data the code running now works on, when `runAsUser` names someone. */
export function currentUserId(): string | undefined {
  return current.getStore();
}

/**
 * The client for the user `runAsUser` names, for code that already runs as a
 * user (an action's `db`). Fails outside `runAsUser`.
 */
export function userDbSync(): ScopedDb {
  const userId = current.getStore();
  if (!userId) throw new Error("No user to work for: not inside runAsUser.");
  return clientFor(userId);
}

/**
 * The database client for the current user: the one `runAsUser` names, or
 * else the signed-in user's. Fails when there's neither.
 */
export async function userDb(): Promise<ScopedDb> {
  const userId = current.getStore();
  if (userId) return clientFor(userId);
  const session = await getSession();
  if (!session) throw new Error("No user to work for: not signed in, and not inside runAsUser.");
  return clientFor(sessionUserId(session));
}
