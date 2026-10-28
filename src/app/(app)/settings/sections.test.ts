import { describe, expect, it } from "vitest";

import { settingsSectionFromParam, settingsSectionHref, settingsSections } from "./sections";

const ALL_ON = { google: true, connector: true };
const ALL_OFF = { google: false, connector: false };

describe("settings sections", () => {
  it("reads the section from the URL, defaulting to AI provider", () => {
    expect(settingsSectionFromParam("data", ALL_ON)).toBe("data");
    expect(settingsSectionFromParam(undefined, ALL_ON)).toBe("ai");
    expect(settingsSectionFromParam("nope", ALL_ON)).toBe("ai");
    expect(settingsSectionFromParam(["about", "data"], ALL_ON)).toBe("ai");
    expect(settingsSectionFromParam("google", ALL_ON)).toBe("google");
    expect(settingsSectionFromParam("claude", ALL_ON)).toBe("claude");
  });

  it("leaves Google and the Claude connector out while they're off, and opens AI provider instead", () => {
    expect(settingsSections(ALL_OFF).map((section) => section.id)).toEqual(["ai", "jobs", "agent", "documents", "data", "about"]);
    expect(settingsSections({ google: true, connector: false }).map((section) => section.id)).toContain("google");
    expect(settingsSections({ google: false, connector: true }).map((section) => section.id)).toContain("claude");
    expect(settingsSectionFromParam("google", ALL_OFF)).toBe("ai");
    expect(settingsSectionFromParam("claude", ALL_OFF)).toBe("ai");
    expect(settingsSectionFromParam("data", ALL_OFF)).toBe("data");
  });

  it("links to a section", () => {
    expect(settingsSectionHref("documents")).toBe("/settings?section=documents");
  });
});
