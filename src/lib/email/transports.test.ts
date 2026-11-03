import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EmailError,
  type EmailMessage,
  fileTransport,
  logTransport,
  MAIL_FILE,
  maskAddress,
  readSentMail,
  RESEND_URL,
  resendTransport,
} from "./transports";

const message = {
  to: "jane@example.com",
  subject: "Confirm your email for RolePebble",
  text: "Hi Jane,\n\nhttps://rolepebble.com/verify-email?token=secret-token\n",
  html: "<p>Hi Jane,</p>",
};

describe("maskAddress", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskAddress("jane@example.com")).toBe("j***@example.com");
    expect(maskAddress("j@example.com")).toBe("j***@example.com");
  });

  it("hides anything that isn't an address", () => {
    expect(maskAddress("not an address")).toBe("***");
    expect(maskAddress("@example.com")).toBe("***");
  });
});

describe("logTransport", () => {
  it("logs one line without the address or the body", async () => {
    const log = vi.fn();
    await logTransport(log).send(message);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      '[email] Not sent (DOSSIER_EMAIL_TRANSPORT=log): "Confirm your email for RolePebble" to j***@example.com',
    );
    const line = log.mock.calls[0][0] as string;
    expect(line).not.toContain("jane@example.com");
    expect(line).not.toContain("secret-token");
    expect(line).not.toContain("\n");
  });

  it("logs to the console by default", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await logTransport().send(message);
    expect(info).toHaveBeenCalledOnce();
    info.mockRestore();
  });
});

describe("fileTransport", () => {
  let dir: string;

  beforeEach(async () => {
    dir = path.join(await mkdtemp(path.join(tmpdir(), "rolepebble-mail-")), "mail");
  });

  afterEach(async () => {
    await rm(path.dirname(dir), { recursive: true, force: true });
  });

  it("appends each email as a line of JSON, creating the folder", async () => {
    const times = [new Date("2026-11-02T09:00:00Z"), new Date("2026-11-02T09:05:00Z")];
    const transport = fileTransport(dir, () => times.shift()!);
    await transport.send(message);
    await transport.send({ to: "sam@example.com", subject: "Reset your RolePebble password", text: "Hi Sam" });

    const lines = (await readFile(path.join(dir, MAIL_FILE), "utf8")).trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ sentAt: "2026-11-02T09:00:00.000Z", ...message });

    expect(await readSentMail(dir)).toEqual([
      { sentAt: "2026-11-02T09:00:00.000Z", ...message },
      { sentAt: "2026-11-02T09:05:00.000Z", to: "sam@example.com", subject: "Reset your RolePebble password", text: "Hi Sam" },
    ]);
  });

  it("stamps the current time by default", async () => {
    await fileTransport(dir).send(message);
    const [mail] = await readSentMail(dir);
    expect(Date.now() - Date.parse(mail.sentAt)).toBeLessThan(60_000);
  });

  it("reads nothing before the first email", async () => {
    expect(await readSentMail(dir)).toEqual([]);
  });

  it("passes on other errors reading the outbox", async () => {
    // A file where the folder should be.
    await writeFile(path.join(path.dirname(dir), "not-a-folder"), "");
    await expect(readSentMail(path.join(path.dirname(dir), "not-a-folder"))).rejects.toMatchObject({ code: "ENOTDIR" });
  });
});

describe("resendTransport", () => {
  const send = (fetch: typeof globalThis.fetch, mail: EmailMessage = message) =>
    resendTransport({ apiKey: "re_test_key", from: "RolePebble <hello@rolepebble.com>", fetch }).send(mail);

  it("posts the email to Resend's API with the key", async () => {
    const fetch = vi.fn(async () => Response.json({ id: "4ef9a417" }));
    await send(fetch);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ authorization: "Bearer re_test_key", "content-type": "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual({
      from: "RolePebble <hello@rolepebble.com>",
      to: ["jane@example.com"],
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  });

  it("leaves out html when there's none", async () => {
    const fetch = vi.fn(async () => Response.json({ id: "4ef9a417" }));
    await send(fetch, { to: "jane@example.com", subject: "Hi", text: "Hello" });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty("html");
  });

  it("uses the global fetch by default", async () => {
    const fetch = vi.fn(async () => Response.json({ id: "4ef9a417" }));
    vi.stubGlobal("fetch", fetch);
    try {
      await resendTransport({ apiKey: "re_test_key", from: "hello@rolepebble.com" }).send(message);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("says why Resend refused, without the key", async () => {
    const fetch = vi.fn(async () =>
      Response.json(
        { statusCode: 403, name: "validation_error", message: "The rolepebble.com domain is not verified.\nMore details" },
        { status: 403 },
      ),
    );
    const error = await send(fetch).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EmailError);
    expect((error as Error).message).toBe("Resend refused the email (403): The rolepebble.com domain is not verified.");
    expect((error as Error).message).not.toContain("re_test_key");
  });

  it("copes with an answer that isn't JSON", async () => {
    const fetch = vi.fn(async () => new Response("Bad gateway", { status: 502 }));
    await expect(send(fetch)).rejects.toThrow(new EmailError("Resend refused the email (502)"));
  });

  it("reports a network failure", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const error = await send(fetch).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EmailError);
    expect(error).toMatchObject({ message: "Resend didn't answer.", cause: new TypeError("fetch failed") });
  });
});
