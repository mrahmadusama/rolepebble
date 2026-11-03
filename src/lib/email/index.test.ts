import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  DOSSIER_EMAIL_TRANSPORT: "file" as "log" | "file" | "resend",
  DOSSIER_EMAIL_FROM: undefined as string | undefined,
  RESEND_API_KEY: undefined as string | undefined,
  DOSSIER_DATA_DIR: "/data",
}));
vi.mock("@/lib/env", () => ({ env }));

const { mailDir, readSentMail, sendEmail, transportFor } = await import("./index");

describe("transportFor", () => {
  it("logs by default", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await transportFor({ ...env, DOSSIER_EMAIL_TRANSPORT: "log" }).send({ to: "jane@example.com", subject: "Hi", text: "Hello" });
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/^\[email\] Not sent/));
    info.mockRestore();
  });

  it("sends through Resend with the key and sender from the environment", async () => {
    const fetch = vi.fn(async () => Response.json({ id: "4ef9a417" }));
    vi.stubGlobal("fetch", fetch);
    try {
      await transportFor({
        ...env,
        DOSSIER_EMAIL_TRANSPORT: "resend",
        DOSSIER_EMAIL_FROM: "RolePebble <hello@rolepebble.com>",
        RESEND_API_KEY: "re_test_key",
      }).send({ to: "jane@example.com", subject: "Hi", text: "Hello" });
    } finally {
      vi.unstubAllGlobals();
    }
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: "Bearer re_test_key" });
    expect(JSON.parse(init.body as string)).toMatchObject({ from: "RolePebble <hello@rolepebble.com>" });
  });
});

describe("sendEmail", () => {
  beforeEach(async () => {
    env.DOSSIER_DATA_DIR = await mkdtemp(path.join(tmpdir(), "rolepebble-data-"));
  });

  afterEach(async () => {
    await rm(env.DOSSIER_DATA_DIR, { recursive: true, force: true });
  });

  it("writes to DOSSIER_DATA_DIR/mail with the file transport", async () => {
    await sendEmail({ to: "jane@example.com", subject: "Hi", text: "Hello" });
    expect(mailDir()).toBe(path.join(env.DOSSIER_DATA_DIR, "mail"));
    expect(await readSentMail(mailDir())).toEqual([
      { sentAt: expect.any(String), to: "jane@example.com", subject: "Hi", text: "Hello" },
    ]);
  });
});
