import { describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./waitlist";

function fakeDb(run: () => Promise<unknown> = async () => ({})) {
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare }, prepare, bind };
}

function post(fields: Record<string, string>, accept = "application/json") {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  return new Request("https://rolepebble.com/api/waitlist", {
    method: "POST",
    body,
    headers: { Accept: accept },
  });
}

describe("POST /api/waitlist", () => {
  it("saves the address, trimmed and lowercased, with the form it came from", async () => {
    const { db, prepare, bind } = fakeDb();
    const response = await onRequestPost({
      request: post({ email: "  Jane@Example.COM ", source: "hero" }),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT (email) DO NOTHING"));
    expect(bind).toHaveBeenCalledWith("jane@example.com", "hero", null, expect.any(String));
  });

  it("keeps no source it doesn't know", async () => {
    const { db, bind } = fakeDb();
    await onRequestPost({ request: post({ email: "a@b.co", source: "<script>" }), env: { DB: db } });
    expect(bind).toHaveBeenCalledWith("a@b.co", null, null, expect.any(String));
  });

  it("keeps where the visitor came from, as a short tag", async () => {
    const { db, prepare, bind } = fakeDb();
    await onRequestPost({ request: post({ email: "a@b.co", ref: " Instagram " }), env: { DB: db } });
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("(email, source, ref, created_at)"));
    expect(bind).toHaveBeenCalledWith("a@b.co", null, "instagram", expect.any(String));
  });

  it.each(["jane@example.com", "<b>hi</b>", "x".repeat(41)])("keeps no tag like %j", async (ref) => {
    const { db, bind } = fakeDb();
    await onRequestPost({ request: post({ email: "a@b.co", ref }), env: { DB: db } });
    expect(bind).toHaveBeenCalledWith("a@b.co", null, null, expect.any(String));
  });

  it.each(["", "not-an-email", "a@b", "a b@c.de", `${"x".repeat(250)}@b.co`])(
    "turns down %j",
    async (email) => {
      const { db, prepare } = fakeDb();
      const response = await onRequestPost({ request: post({ email }), env: { DB: db } });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        ok: false,
        error: "Please enter a valid email address.",
      });
      expect(prepare).not.toHaveBeenCalled();
    },
  );

  it("tells bots that fill in the hidden field it worked, and saves nothing", async () => {
    const { db, prepare } = fakeDb();
    const response = await onRequestPost({
      request: post({ email: "bot@spam.example", website: "https://spam.example" }),
      env: { DB: db },
    });

    expect(await response.json()).toEqual({ ok: true });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("says so when the database fails", async () => {
    const { db } = fakeDb(() => Promise.reject(new Error("D1 is down")));
    const response = await onRequestPost({ request: post({ email: "a@b.co" }), env: { DB: db } });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("turns down a body that isn't a form", async () => {
    const { db } = fakeDb();
    const request = new Request("https://rolepebble.com/api/waitlist", {
      method: "POST",
      body: "{}",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
    });
    const response = await onRequestPost({ request, env: { DB: db } });
    expect(response.status).toBe(400);
  });

  describe("without the page's script", () => {
    it("redirects to the thank-you page", async () => {
      const { db } = fakeDb();
      const response = await onRequestPost({
        request: post({ email: "a@b.co" }, "text/html"),
        env: { DB: db },
      });

      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("https://rolepebble.com/thanks");
    });

    it("redirects back to the form when the address isn't valid", async () => {
      const { db } = fakeDb();
      const response = await onRequestPost({
        request: post({ email: "nope" }, "text/html"),
        env: { DB: db },
      });

      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("https://rolepebble.com/?invalid#join");
    });
  });
});
