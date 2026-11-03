import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// One-time link tokens, for "confirm your email" and "reset your password".
// The token goes out in the link; only its SHA-256 hash is stored, so someone
// who reads the database can't use the links in it. A token is 32 random
// bytes, too many to guess, which is why a plain hash (not a slow password
// hash) is enough.

const TOKEN_BYTES = 32;
const HOUR = 60 * 60 * 1000;

/** How long each kind of link works. */
export const TOKEN_LIFETIME_MS = {
  verifyEmail: 24 * HOUR,
  resetPassword: HOUR,
} as const;

export type TokenPurpose = keyof typeof TOKEN_LIFETIME_MS;

// 32 bytes in base64url, without padding: 43 characters.
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;
const HASH_FORMAT = /^[0-9a-f]{64}$/;

/** A new random token for a link, URL-safe (base64url, 43 characters). */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Whether `value` could be a token at all, to turn away anything else before looking it up. */
export function isTokenFormat(value: string): boolean {
  return TOKEN_FORMAT.test(value);
}

/** What to store for a token: its SHA-256 hash, in hex (64 characters). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Whether `token` is the one `storedHash` was made from. Takes the same time however much of it matches. */
export function tokenMatches(token: string, storedHash: string): boolean {
  if (!HASH_FORMAT.test(storedHash)) return false;
  return timingSafeEqual(Buffer.from(hashToken(token), "hex"), Buffer.from(storedHash, "hex"));
}

/** When a token made now for `purpose` stops working. */
export function tokenExpiry(purpose: TokenPurpose, now = new Date()): Date {
  return new Date(now.getTime() + TOKEN_LIFETIME_MS[purpose]);
}

/** Whether a token that stops working at `expiresAt` has. */
export function isExpired(expiresAt: Date, now = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}
