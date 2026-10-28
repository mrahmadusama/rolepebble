import type { Features } from "@/lib/features";

/** The settings sections, in order (PRD §6.8). */
export const SETTINGS_SECTIONS = [
  { id: "ai", label: "AI provider" },
  { id: "jobs", label: "Job search" },
  { id: "agent", label: "Job agent" },
  { id: "documents", label: "Documents" },
  { id: "google", label: "Google", feature: "google" },
  { id: "claude", label: "Claude connector", feature: "connector" },
  { id: "data", label: "Your data" },
  { id: "about", label: "About" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

/** The sections in the list, without those of the features switched off (src/lib/features.ts). */
export function settingsSections(features: Features) {
  return SETTINGS_SECTIONS.filter((section) => !("feature" in section) || features[section.feature]);
}

/** The section in `?section=`, or AI provider when it's missing, unknown or switched off. */
export function settingsSectionFromParam(value: string | string[] | undefined, features: Features): SettingsSectionId {
  return settingsSections(features).find((section) => section.id === value)?.id ?? "ai";
}

export const settingsSectionHref = (id: SettingsSectionId) => `/settings?section=${id}`;
