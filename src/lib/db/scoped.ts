import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { OWNED_MODELS, SHARED_ROWS_MODELS, SYSTEM_MODELS } from "./owned-models";

// The database client for one user's data (Phase 2). Every query on a
// per-user table is limited to that user's rows, and runs in a transaction
// that first sets `app.user_id`, which is how the database fills in `userId`
// on new rows (rp_current_user_id()) and, later, enforces row-level security.
// This is Prisma's own pattern for row-level security with client extensions.
//
// Get one with `userDb()` (./context), never by importing `@/lib/prisma`
// (db-audit.test.ts checks).

/** Operations whose `where` names one row: the owner goes next to its unique fields. */
const UNIQUE_WHERE = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);
/** Operations whose `where` filters rows. */
const FILTER_WHERE = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "updateManyAndReturn",
  "deleteMany",
]);
/** Operations that only read, which may see rows shared by everyone (built-in themes). */
const READS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);

type Args = Record<string, unknown>;

/** Who a query may touch: the user's rows, plus shared ones when it only reads. */
function ownerFilter(model: Prisma.ModelName, operation: string, userId: string) {
  return SHARED_ROWS_MODELS.has(model) && READS.has(operation) ? { OR: [{ userId }, { userId: null }] } : { userId };
}

/** Refuses data that names another user as the owner. Leaving `userId` out is the normal case. */
function checkOwner(model: string, data: unknown, userId: string) {
  for (const row of Array.isArray(data) ? data : [data]) {
    const owner = row && typeof row === "object" ? (row as Args).userId : undefined;
    if (owner !== undefined && owner !== userId) {
      throw new Error(`Refusing to write ${model} data for another user.`);
    }
  }
}

/** The arguments of an operation on `model`, limited to `userId`'s rows. */
export function scopeArgs(model: Prisma.ModelName, operation: string, args: Args | undefined, userId: string): Args | undefined {
  if (SYSTEM_MODELS.has(model)) {
    throw new Error(`${model} isn't a user's data: use the system client for it.`);
  }
  if (!OWNED_MODELS.has(model)) return args;

  const scoped: Args = { ...args };
  const filter = ownerFilter(model, operation, userId);
  if (UNIQUE_WHERE.has(operation)) {
    const where = (scoped.where ?? {}) as Args;
    const and = where.AND === undefined ? [] : Array.isArray(where.AND) ? where.AND : [where.AND];
    scoped.where = { ...where, AND: [...and, filter] };
  } else if (FILTER_WHERE.has(operation)) {
    scoped.where = scoped.where === undefined ? filter : { AND: [scoped.where, filter] };
  }
  if (operation === "create" || operation === "createMany" || operation === "createManyAndReturn") {
    checkOwner(model, scoped.data, userId);
  }
  if (operation === "upsert") checkOwner(model, scoped.create, userId);
  if (operation === "update" || operation === "updateMany" || operation === "updateManyAndReturn" || operation === "upsert") {
    checkOwner(model, operation === "upsert" ? scoped.update : scoped.data, userId);
  }
  return scoped;
}

/** Limits every operation on per-user tables to `userId`'s rows. */
function ownerFilterExtension(userId: string) {
  return Prisma.defineExtension({
    name: "rolepebble-owner-filter",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args as Args, userId) as typeof args);
        },
      },
    },
  });
}

/**
 * The client for `userId`'s data. Interactive transactions go through
 * `$userTransaction`, never `$transaction`: every query already runs in a
 * transaction of its own here, and Postgres can't nest them.
 */
export function scopedDb(userId: string, base: PrismaClient = prisma) {
  const filtered = base.$extends(ownerFilterExtension(userId));
  const setUser = () => base.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;

  return base.$extends(ownerFilterExtension(userId)).$extends({
    name: "rolepebble-user",
    query: {
      // Every operation, raw queries included, runs after app.user_id is set.
      async $allOperations({ args, query }) {
        const [, result] = await base.$transaction([setUser(), query(args)]);
        return result;
      },
    },
    client: {
      /** Whose data this client works on. */
      $userId: userId,
      /**
       * An interactive transaction on this user's data. Inside it, `tx` is
       * limited to the user like this client is.
       */
      $userTransaction<T>(
        fn: (tx: Prisma.TransactionClient) => Promise<T>,
        options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
      ): Promise<T> {
        return filtered.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
          return fn(tx as unknown as Prisma.TransactionClient);
        }, options);
      },
    },
  });
}

/** A client limited to one user's data (`scopedDb`). */
export type ScopedDb = ReturnType<typeof scopedDb>;
