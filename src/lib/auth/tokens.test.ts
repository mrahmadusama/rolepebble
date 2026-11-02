import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { generateToken, hashToken, isExpired, isTokenFormat, TOKEN_LIFETIME_MS, tokenExpiry, tokenMatches } from "./tokens";

describe("generateToken", () => {
  it("makes URL-safe tokens of 32 random bytes", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(isTokenFormat(token)).toBe(true);
  });

  it("never makes the same token twice", () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateToken));
    expect(tokens.size).toBe(1000);
  });
});

describe("isTokenFormat", () => {
  it("turns away anything that can't be a token", () => {
    expect(isTokenFormat("")).toBe(false);
    expect(isTokenFormat("a".repeat(42))).toBe(false);
    expect(isTokenFormat("a".repeat(44))).toBe(false);
    expect(isTokenFormat(`${"a".repeat(42)}=`)).toBe(false);
    expect(isTokenFormat(`${"a".repeat(42)}+`)).toBe(false);
  });
});

describe("hashToken", () => {
  it("is the SHA-256 of the token, in hex", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });

  it("gives the same hash for the same token only", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(hashToken(generateToken()));
  });
});

describe("tokenMatches", () => {
  const token = generateToken();
  const stored = hashToken(token);

  it("accepts the token its hash was made from", () => {
    expect(tokenMatches(token, stored)).toBe(true);
  });

  it("refuses any other token", () => {
    expect(tokenMatches(generateToken(), stored)).toBe(false);
    expect(tokenMatches(`${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`, stored)).toBe(false);
    expect(tokenMatches("", stored)).toBe(false);
  });

  it("refuses a stored value that isn't a hash, rather than throwing", () => {
    expect(tokenMatches(token, "")).toBe(false);
    expect(tokenMatches(token, stored.slice(0, 63))).toBe(false);
    expect(tokenMatches(token, stored.toUpperCase())).toBe(false);
    expect(tokenMatches(token, token)).toBe(false);
  });
});

describe("expiry", () => {
  const now = new Date("2026-11-02T09:00:00Z");

  it("gives email confirmations 24 hours and password resets one", () => {
    expect(tokenExpiry("verifyEmail", now)).toEqual(new Date("2026-11-03T09:00:00Z"));
    expect(tokenExpiry("resetPassword", now)).toEqual(new Date("2026-11-02T10:00:00Z"));
    expect(TOKEN_LIFETIME_MS.resetPassword).toBe(60 * 60 * 1000);
  });

  it("counts from now by default", () => {
    const expiry = tokenExpiry("resetPassword").getTime();
    expect(Math.abs(expiry - (Date.now() + TOKEN_LIFETIME_MS.resetPassword))).toBeLessThan(1000);
    expect(isExpired(new Date(Date.now() + 60_000))).toBe(false);
    expect(isExpired(new Date(Date.now() - 1))).toBe(true);
  });

  it("works until the moment it expires, not after", () => {
    const expiresAt = tokenExpiry("resetPassword", now);
    expect(isExpired(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(false);
    expect(isExpired(expiresAt, expiresAt)).toBe(true);
    expect(isExpired(expiresAt, new Date(expiresAt.getTime() + 1))).toBe(true);
  });
});
