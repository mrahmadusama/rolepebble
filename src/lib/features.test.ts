import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ DOSSIER_SECRET: "s".repeat(32), DOSSIER_GOOGLE: "off", DOSSIER_CONNECTOR: "off" }));
vi.mock("@/lib/env", () => ({ env }));
vi.mock("@/lib/auth/session", async (original) => ({
  ...(await original<typeof import("@/lib/auth/session")>()),
  getSession: async () => ({ persistent: false, issuedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }),
}));
// A refusal comes first: nothing is read or saved.
const touched = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: (_, key) => (touched.push(`prisma.${String(key)}`), undefined) }),
}));
vi.mock("@/lib/settings-data", () => ({
  loadSettings: async () => (touched.push("loadSettings"), {}),
  saveSettings: async () => void touched.push("saveSettings"),
}));

import { answerConnector } from "@/app/oauth/authorize/actions";
import { handOffToClaude } from "@/app/(app)/new/actions";
import { disconnectClaude, setConnector } from "@/app/(app)/settings/actions";
import { checkInbox, saveGoogleSettings, sendWithGmail } from "@/lib/google/actions";
import { googleClient } from "@/lib/google/oauth";

import { connectorEnabled, features, googleEnabled } from "./features";

const GOOGLE_OFF = { ok: false, error: "Gmail and Google Calendar aren't available on this server." };
const CONNECTOR_OFF = { ok: false, error: "The Claude connector isn't available on this server." };

beforeEach(() => {
  env.DOSSIER_GOOGLE = "off";
  env.DOSSIER_CONNECTOR = "off";
  touched.length = 0;
});

describe("feature switches", () => {
  it("reads DOSSIER_GOOGLE and DOSSIER_CONNECTOR", () => {
    expect(features()).toEqual({ google: false, connector: false });
    env.DOSSIER_GOOGLE = "on";
    expect(googleEnabled()).toBe(true);
    expect(connectorEnabled()).toBe(false);
    env.DOSSIER_CONNECTOR = "on";
    expect(features()).toEqual({ google: true, connector: true });
  });
});

describe("while Gmail and Calendar are off", () => {
  it("refuses their Server Actions before doing anything", async () => {
    expect(await checkInbox({})).toEqual(GOOGLE_OFF);
    expect(await sendWithGmail({ id: "application-1" })).toEqual(GOOGLE_OFF);
    expect(await saveGoogleSettings({ gmailRead: true })).toEqual(GOOGLE_OFF);
    expect(touched).toEqual([]);
  });

  it("has no Google client, so nothing calls Google", async () => {
    expect(await googleClient()).toBeNull();
  });
});

describe("while the Claude connector is off", () => {
  it("refuses its Server Actions before doing anything", async () => {
    expect(await setConnector({ on: true })).toEqual(CONNECTOR_OFF);
    expect(await disconnectClaude({})).toEqual(CONNECTOR_OFF);
    expect(await handOffToClaude({ posting: "A posting", postingUrl: "" })).toEqual(CONNECTOR_OFF);
    expect(
      await answerConnector({ client_id: "c", redirect_uri: "https://claude.ai/api/mcp/auth_callback", code_challenge: "x", code_challenge_method: "S256", state: "", resource: "", allow: true }),
    ).toEqual(CONNECTOR_OFF);
    expect(touched).toEqual([]);
  });
});
