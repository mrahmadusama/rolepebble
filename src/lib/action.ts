import "server-only";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { getSession, type Session } from "@/lib/auth/session";
import { runAsUser, sessionUserId, userDbSync, type ScopedDb } from "@/lib/db";
import { logServerError } from "@/lib/log";
import { messages } from "@/lib/messages";

/**
 * What every Server Action returns. `error` is written for the user. `toast`
 * is an optional confirmation the client shows, e.g. "Marked as sent."
 */
export type ActionResult<T> =
  | { ok: true; data: T; toast?: string }
  | {
      ok: false;
      error: string;
      /** Messages per input field when validation failed. */
      fieldErrors?: Partial<Record<string, string[]>>;
    };

/** Throw from an action handler to fail with a message the user sees as is. */
export class ActionError extends Error {
  override name = "ActionError";
}

export type ActionContext = {
  session: Session;
  /** The signed-in user's data (src/lib/db); `userDb()` gives the same client. */
  db: ScopedDb;
  /** Shows a toast after the action succeeds. */
  toast: (message: string) => void;
};

/**
 * Defines a Server Action. The action checks the session, validates its input
 * with `schema`, runs `handler` as the signed-in user (`runAsUser`, so
 * `userDb()` works anywhere below it) and returns an `ActionResult`: unexpected
 * errors are logged and turned into a generic message, so the client never
 * sees stack traces or data. `redirect()` and `notFound()` still work inside
 * the handler.
 *
 * Export the result from a `"use server"` file:
 *
 *     export const renameTheme = action(
 *       z.object({ id: z.string(), name: z.string().min(1) }),
 *       async ({ id, name }, { toast }) => { ... },
 *     );
 */
export function action<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>, context: ActionContext) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (input) => {
    const session = await getSession();
    if (!session) return { ok: false, error: messages.signedOut };
    return runAsUser(sessionUserId(session), () =>
      run(schema, input, (data, toast) =>
        handler(data, {
          session,
          // Made on first use, so handlers that don't touch the database don't need one.
          get db() {
            return userDbSync();
          },
          toast,
        }),
      ),
    );
  };
}

/**
 * Like `action()`, but for the few actions that must work signed out, such
 * as signing in. Anyone can call it, so it must not return private data.
 */
export function publicAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>, context: Omit<ActionContext, "session" | "db">) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (input) => run(schema, input, (data, toast) => handler(data, { toast }));
}

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  handler: (input: z.output<S>, toast: (message: string) => void) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: messages.invalidInput,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  let toast: string | undefined;
  try {
    const data = await handler(parsed.data, (message) => {
      toast = message;
    });
    return toast === undefined ? { ok: true, data } : { ok: true, data, toast };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ActionError) return { ok: false, error: error.message };
    logServerError("action", error);
    return { ok: false, error: messages.unexpected };
  }
}
