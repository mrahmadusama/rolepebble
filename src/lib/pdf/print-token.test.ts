import { describe, expect, it, vi } from "vitest";

import { PRINT_TOKEN_LIFETIME_SECONDS, signPrintToken, verifyPrintToken } from "./print-token";

vi.mock("@/lib/env", () => ({ env: { DOSSIER_SECRET: "a".repeat(32) } }));

describe("print tokens", () => {
  it("open the page they were made for", async () => {
    const token = await signPrintToken("/print/base", "owner");
    expect(await verifyPrintToken(token, "/print/base")).toBe("owner");
  });

  it("don't open any other page", async () => {
    const token = await signPrintToken("/print/base", "owner");
    expect(await verifyPrintToken(token, "/print/resume/1")).toBeNull();
    expect(await verifyPrintToken(token, "/print/base/")).toBeNull();
  });

  it("expire after a minute", async () => {
    const token = await signPrintToken("/print/base", "owner");
    const later = new Date(Date.now() + (PRINT_TOKEN_LIFETIME_SECONDS + 1) * 1000);
    expect(await verifyPrintToken(token, "/print/base", { now: later })).toBeNull();
  });

  it("need the server's secret", async () => {
    const forged = await signPrintToken("/print/base", "owner", "b".repeat(32));
    expect(await verifyPrintToken(forged, "/print/base")).toBeNull();
    expect(await verifyPrintToken("garbage", "/print/base")).toBeNull();
    expect(await verifyPrintToken(null, "/print/base")).toBeNull();
  });
});
