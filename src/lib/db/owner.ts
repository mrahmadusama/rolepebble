// No "server-only": the seed and the tests import it too.

/**
 * The account all data belongs to until sign-in knows users (Phase 2, PR 10):
 * the migration 20261102120000_owners creates it, and the database gives new
 * rows to it when no user is named.
 */
export const OWNER_ID = "owner";

/** The owner account's placeholder address; `.invalid` can never receive mail. */
export const OWNER_EMAIL = "owner@rolepebble.invalid";
